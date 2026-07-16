'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type CouponProductOption = { id: string; name: string };

export function CouponForm({ products }: { products: CouponProductOption[] }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState<'cart' | 'product'>('cart');
  const [productId, setProductId] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/admin/cupones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        type,
        value,
        scope,
        productId: scope === 'product' ? productId : null,
        minSubtotal: minSubtotal || null,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expiresAt: expiresAt || null,
        isActive,
      }),
    });
    if (res.ok) {
      setCode('');
      setValue('');
      setScope('cart');
      setProductId('');
      setMinSubtotal('');
      setMaxRedemptions('');
      setExpiresAt('');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo crear el cupón.');
    }
    setLoading(false);
  }

  const input = 'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2';
  const label = 'block text-sm text-[hsl(var(--muted-foreground))] mb-1';

  return (
    <form onSubmit={handleSubmit} className="border border-[hsl(var(--border))] rounded-xl p-5 space-y-4 max-w-xl">
      <h2 className="font-medium">Nuevo cupón</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Código</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="BIENVENIDA"
            className={input}
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
          <label className={label}>Máx. usos (opcional)</label>
          <input
            inputMode="numeric"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="∞"
            className={input}
          />
        </div>
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
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2.5 font-medium disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Crear cupón'}
      </button>
    </form>
  );
}
