import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from './db';
import { adminTwoFactor, type AdminTwoFactor } from './db/schema';
import { adminMfaSecret } from './admin-mfa-cookie';
import { base32Encode, generateTotpSecret, matchTotp } from './totp';

/**
 * Verificación en dos pasos del panel admin (app autenticadora + códigos de
 * respaldo). El primer factor sigue siendo la contraseña de nume.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RECOVERY_CODE_COUNT = 8;

function encryptionKey(): Buffer {
  const secret = adminMfaSecret();
  if (!secret) throw new Error('ADMIN_2FA_SECRET no está configurado.');
  return createHash('sha256').update(`admin-totp:${secret}`).digest();
}

export function encryptTotpSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptTotpSecret(value: string): string {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z2-7]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

/** Códigos de 10 caracteres en dos grupos: "K7QX2-MV4PA". */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const code = base32Encode(randomBytes(7)).slice(0, 10);
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

export type SecondFactorResult =
  | { ok: true; recoveryCodes?: string[]; usedRecoveryCode?: boolean; recoveryCodesLeft?: number }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): SecondFactorResult => ({ ok: false, status, error });

export async function getAdminTwoFactor(userId: string): Promise<AdminTwoFactor | null> {
  const [row] = await db.select().from(adminTwoFactor).where(eq(adminTwoFactor.userId, userId)).limit(1);
  return row ?? null;
}

/**
 * Secreto para dar de alta la app. Reusa el pendiente (recargar la página no
 * cambia el QR) y nunca toca uno ya activo.
 */
export async function pendingTotpSecret(user: { id: string; email: string }): Promise<string> {
  const existing = await getAdminTwoFactor(user.id);
  if (existing?.enabledAt) throw new Error('La verificación en dos pasos ya está activa.');
  if (existing) return decryptTotpSecret(existing.secretEncrypted);

  const secret = generateTotpSecret();
  await db
    .insert(adminTwoFactor)
    .values({ userId: user.id, email: user.email, secretEncrypted: encryptTotpSecret(secret) })
    .onConflictDoNothing();
  // Si otra pestaña lo creó al mismo tiempo, gana la fila guardada.
  const saved = await getAdminTwoFactor(user.id);
  return saved ? decryptTotpSecret(saved.secretEncrypted) : secret;
}

function lockedMessage(row: AdminTwoFactor): string | null {
  if (!row.lockedUntil || row.lockedUntil.getTime() <= Date.now()) return null;
  const minutes = Math.max(1, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000));
  return `Demasiados códigos incorrectos. Intenta de nuevo en ${minutes} min.`;
}

async function registerFailure(userId: string): Promise<void> {
  await db
    .update(adminTwoFactor)
    .set({
      failedAttempts: sql`${adminTwoFactor.failedAttempts} + 1`,
      lockedUntil: sql`CASE WHEN ${adminTwoFactor.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS}
        THEN now() + make_interval(mins => ${LOCK_MINUTES}::int) ELSE ${adminTwoFactor.lockedUntil} END`,
      updatedAt: new Date(),
    })
    .where(eq(adminTwoFactor.userId, userId));
}

/**
 * Guarda el paso TOTP usado. La condición evita que dos peticiones simultáneas
 * acepten el mismo código.
 */
async function claimStep(userId: string, step: number, extra: Partial<AdminTwoFactor> = {}): Promise<boolean> {
  const updated = await db
    .update(adminTwoFactor)
    .set({ ...extra, lastUsedStep: step, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(and(
      eq(adminTwoFactor.userId, userId),
      or(isNull(adminTwoFactor.lastUsedStep), lt(adminTwoFactor.lastUsedStep, step)),
    ))
    .returning({ userId: adminTwoFactor.userId });
  return updated.length > 0;
}

/** Primer código correcto: activa el 2FA y entrega los códigos de respaldo (una sola vez). */
export async function confirmEnrollment(userId: string, code: string): Promise<SecondFactorResult> {
  const row = await getAdminTwoFactor(userId);
  if (!row) return fail(409, 'Vuelve a cargar la página para generar el código QR.');
  if (row.enabledAt) return fail(409, 'La verificación en dos pasos ya está activa.');
  const locked = lockedMessage(row);
  if (locked) return fail(429, locked);

  const step = matchTotp(decryptTotpSecret(row.secretEncrypted), code);
  if (step === null) {
    await registerFailure(userId);
    return fail(401, 'El código no coincide. Revisa que la hora de tu teléfono sea automática.');
  }

  const recoveryCodes = generateRecoveryCodes();
  const claimed = await claimStep(userId, step, {
    enabledAt: new Date(),
    recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
  });
  if (!claimed) return fail(401, 'Ese código ya se usó. Espera al siguiente.');
  return { ok: true, recoveryCodes };
}

/** Código de la app o, si no la tiene a la mano, uno de respaldo (se gasta al usarlo). */
export async function verifySecondFactor(userId: string, code: string): Promise<SecondFactorResult> {
  const row = await getAdminTwoFactor(userId);
  if (!row?.enabledAt) return fail(409, 'Primero configura tu app autenticadora.');
  const locked = lockedMessage(row);
  if (locked) return fail(429, locked);

  const step = matchTotp(decryptTotpSecret(row.secretEncrypted), code, { afterStep: row.lastUsedStep ?? -1 });
  if (step !== null) {
    if (await claimStep(userId, step)) return { ok: true };
    return fail(401, 'Ese código ya se usó. Espera al siguiente.');
  }

  const hash = hashRecoveryCode(code);
  const isRecovery = normalizeRecoveryCode(code).length === 10 &&
    row.recoveryCodeHashes.some((saved) => timingSafeEqual(Buffer.from(saved), Buffer.from(hash)));
  if (isRecovery) {
    const remaining = row.recoveryCodeHashes.filter((saved) => saved !== hash);
    // Solo gana quien todavía encuentra el código en la lista.
    const updated = await db
      .update(adminTwoFactor)
      .set({ recoveryCodeHashes: remaining, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(and(
        eq(adminTwoFactor.userId, userId),
        sql`${adminTwoFactor.recoveryCodeHashes} @> ${JSON.stringify([hash])}::jsonb`,
      ))
      .returning({ userId: adminTwoFactor.userId });
    if (updated.length > 0) return { ok: true, usedRecoveryCode: true, recoveryCodesLeft: remaining.length };
  }

  await registerFailure(userId);
  return fail(401, 'El código no es válido.');
}
