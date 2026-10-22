'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminHref } from '@/components/admin/admin-path';

type Enrollment = { qrSvg: string; secret: string };

const input = 'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2 tracking-widest';
const primaryButton =
  'w-full rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2.5 font-medium disabled:opacity-50';
const muted = 'text-sm text-[hsl(var(--muted-foreground))]';

/** Alta de la app autenticadora (si `enrollment`) o código del segundo paso. */
export function TwoFactorForm({ email, enrollment }: { email: string; enrollment: Enrollment | null }) {
  const router = useRouter();
  const adminHref = useAdminHref();
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryLeft, setRecoveryLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  function enterPanel() {
    router.replace(adminHref());
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(enrollment ? '/api/admin/2fa/activar' : '/api/admin/2fa/verificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'No se pudo verificar el código.');
      setLoading(false);
      return;
    }
    if (data.recoveryCodes) {
      setRecoveryCodes(data.recoveryCodes);
    } else if (data.usedRecoveryCode) {
      setRecoveryLeft(data.recoveryCodesLeft ?? 0);
    } else {
      enterPanel();
    }
    setLoading(false);
  }

  async function copyCodes() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Guarda tus códigos de respaldo</h1>
        <p className={muted}>
          Si pierdes tu teléfono, cada código te deja entrar una vez. Guárdalos en un lugar seguro, como tu
          gestor de contraseñas: no los volveremos a mostrar.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-[hsl(var(--border))] p-4 font-mono text-sm">
          {recoveryCodes.map((recovery) => (
            <li key={recovery}>{recovery}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={copyCodes}
          className="w-full rounded-lg border border-[hsl(var(--border))] px-5 py-2.5 font-medium hover:bg-[hsl(var(--muted))]"
        >
          {copied ? 'Copiados' : 'Copiar códigos'}
        </button>
        <button type="button" onClick={enterPanel} className={primaryButton}>
          Ya los guardé, entrar al panel
        </button>
      </div>
    );
  }

  if (recoveryLeft !== null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Usaste un código de respaldo</h1>
        <p className={muted}>
          {recoveryLeft === 0
            ? 'Ya no te quedan códigos de respaldo. Pide al equipo técnico que reinicie tu verificación para generar nuevos.'
            : `Te quedan ${recoveryLeft} códigos de respaldo.`}
        </p>
        <button type="button" onClick={enterPanel} className={primaryButton}>
          Entrar al panel
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {enrollment ? 'Configura la verificación en dos pasos' : 'Verificación en dos pasos'}
      </h1>

      {enrollment ? (
        <>
          <p className={muted}>
            Para entrar al panel, además de tu contraseña necesitas un código de tu teléfono. Escanea este QR con
            una app autenticadora (Google Authenticator, 1Password, Authy…) y escribe el código de 6 dígitos que te
            muestre.
          </p>
          {/* El QR va negro sobre blanco en ambos temas: las apps no leen uno invertido. */}
          <div
            className="mx-auto w-fit rounded-lg bg-white p-3"
            aria-label="Código QR para la app autenticadora"
            dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
          />
          <p className={muted}>
            ¿No puedes escanearlo? Escribe esta clave en la app:{' '}
            <code className="break-all font-mono text-[hsl(var(--foreground))]">
              {enrollment.secret.match(/.{1,4}/g)?.join(' ')}
            </code>
          </p>
        </>
      ) : (
        <p className={muted}>
          {useRecovery
            ? 'Escribe uno de tus códigos de respaldo. Cada uno sirve una sola vez.'
            : `Escribe el código de 6 dígitos de tu app autenticadora para ${email}.`}
        </p>
      )}

      <input
        type="text"
        inputMode={useRecovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        placeholder={useRecovery ? 'XXXXX-XXXXX' : '123456'}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={useRecovery ? 11 : 6}
        autoFocus
        className={input}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={loading || !code.trim()} className={primaryButton}>
        {loading ? 'Verificando…' : enrollment ? 'Activar' : 'Entrar'}
      </button>

      {!enrollment && (
        <button
          type="button"
          onClick={() => {
            setUseRecovery((value) => !value);
            setCode('');
            setError(null);
          }}
          className={`${muted} w-full hover:underline`}
        >
          {useRecovery ? 'Usar el código de la app' : 'No tengo mi teléfono: usar un código de respaldo'}
        </button>
      )}
    </form>
  );
}
