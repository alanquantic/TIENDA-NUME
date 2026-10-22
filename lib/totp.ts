import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Códigos de un solo uso por tiempo (TOTP, RFC 6238): SHA-1, 6 dígitos, 30 s.
 * Es lo que generan Google Authenticator, 1Password, Authy, etc.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Secreto TOTP inválido.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secreto nuevo de 160 bits en base32, como lo piden las apps. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpStep(now = Date.now()): number {
  return Math.floor(now / 1000 / PERIOD_SECONDS);
}

export function totpCode(secret: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Paso de tiempo al que corresponde el código, o null. Acepta un periodo antes
 * y uno después (relojes desfasados) y nunca un paso igual o anterior a
 * `afterStep`, para que un código ya usado no sirva dos veces.
 */
export function matchTotp(
  secret: string,
  code: string,
  { now = Date.now(), window = 1, afterStep = -1 }: { now?: number; window?: number; afterStep?: number } = {},
): number | null {
  const clean = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const current = totpStep(now);
  for (let step = current - window; step <= current + window; step++) {
    if (step <= afterStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(clean))) return step;
  }
  return null;
}

/** URI que codifica el QR para dar de alta la cuenta en la app. */
export function otpauthUri({ secret, account, issuer }: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: String(PERIOD_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
