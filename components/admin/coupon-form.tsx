'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminHref } from '@/components/admin/admin-path';

export type CouponProductOption = { id: string; name: string };

/** Valores de un cupón existente para editarlo (montos como texto, fecha YYYY-MM-DD). */
export type CouponFormValues = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  scope: 'cart' | 'product';
  productId: string | null;
  minSubtotal: string | null;
  maxRedemptions: number | null;
  maxRedemptionsPerEmail: number | null;
  expiresAt: string | null;
  isActive: boolean;
  timesRedeemed: number;
};

export function CouponForm({
  products,
  initialValues,
}: {
  products: CouponProductOption[];
  initialValues?: CouponFormValues;
}) {
  const router = useRouter();
  const adminHref = useAdminHref();
  const editing = !!initialValues;
  // El conteo por correo va por código: un cupón ya usado no se renombra.
  const codeLocked = editing && initialValues.timesRedeemed > 0;
  const [code, setCode] = useState(initialValues?.code ?? '');
  const [type, setType] = useState<'percent' | 'fixed'>(initialValues?.type ?? 'percent');
  const [value, setValue] = useState(initialValues ? String(parseFloat(initialValues.value)) : '');
  const [scope, setScope] = useState<'cart' | 'product'>(initialValues?.scope ?? 'cart');
  const [productId, setProductId] = useState(initialValues?.productId ?? '');
  const [minSubtotal, setMinSubtotal] = useState(initialValues?.minSubtotal ?? '');
  const [maxRedemptions, setMaxRedemptions] = useState(
    initialValues?.maxRedemptions != null ? String(initialValues.maxRedemptions) : '',
  );
  const [maxPerEmail, setMaxPerEmail] = useState(
    initialValues?.maxRedemptionsPerEmail != null ? String(initialValues.maxRedemptionsPerEmail) : '',
  );
  const [expiresAt, setExpiresAt] = useState(initialValues?.expiresAt ?? '');
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(editing ? `/api/admin/cupones/${initialValues.id}` : '/api/admin/cupones', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        type,
        value,
        scope,
        productId: scope === 'product' ? productId : null,
        minSubtotal: minSubtotal || null,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        maxRedemptionsPerEmail: maxPerEmail ? Number(maxPerEmail) : null,
        expiresAt: expiresAt || null,
        isActive,
      }),
    });
    if (res.ok && editing) {
      router.push(adminHref('/cupones'));
      router.refresh();
      return;
    }
    if (res.ok) {
      setCode('');
      setValue('');
      setScope('cart');
      setProductId('');
      setMinSubtotal('');
      setMaxRedemptions('');
      setMaxPerEmail('');
      setExpiresAt('');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? (editing ? 'No se pudo guardar el cupón.' : 'No se pudo crear el cupón.'));
    }
    setLoading(false);
  }

  const input = 'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2';
  const label = 'block text-sm text-[hsl(var(--muted-foreground))] mb-1';

  return (
    <form onSubmit={handleSubmit} className="border border-[hsl(var(--border))] rounded-xl p-5 space-y-4 max-w-xl">
      {!editing && <h2 className="font-medium">Nuevo cupón</h2>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Código</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="BIENVENIDA"
            disabled={codeLocked}
            title={codeLocked ? 'El cupón ya se usó: su código no se puede cambiar.' : undefined}
            className={`${input} disabled:opacity-60`}
          />
        </div>
        <div>
          <label className={label}>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'percent' | 'fixed')} className={input}>
            <option value="percent">Porcentaje (%)</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>{type === 'percent' ? 'Porcentaje' : 'Monto'}</label>
          <input
            required
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'percent' ? '10' : '100.00'}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Subtotal mínimo (opcional)</label>
          <input
            inputMode="decimal"
            value={minSubtotal}
            onChange={(e) => setMinSubtotal(e.target.value)}
            placeholder="0.00"
            className={input}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Aplica a</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as 'cart' | 'product')}
            className={input}
          >
            <option value="cart">Total del carrito</option>
            <option value="product">Un producto específico</option>
          </select>
        </div>
        {scope === 'product' && (
          <div>
            <label className={label}>Producto</label>
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={input}
            >
              <option value="">Selecciona…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {scope === 'product' && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          El descuento solo se calcula sobre las líneas de ese producto, no sobre el carrito completo.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Máx. usos en total (opcional)</label>
          <input
            inputMode="numeric"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="∞"
            className={input}
          />
        </div>
        <div>
          <label className={label}>Máx. usos por correo (opcional)</label>
          <input
            inputMode="numeric"
            value={maxPerEmail}
            onChange={(e) => setMaxPerEmail(e.target.value)}
            placeholder="∞"
            className={input}
          />
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            1 = una sola compra por cliente. Cuenta pedidos pagados con ese correo.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Expira (opcional)</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={input} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Activo
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {loading ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cupón'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => router.push(adminHref('/cupones'))}
            className="text-sm text-[hsl(var(--muted-foreground))] hover:underline"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
