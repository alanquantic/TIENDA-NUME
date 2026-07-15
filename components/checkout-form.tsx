'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { formatMoney, toMinor } from '@/lib/money';
import { isReportSlug, reportForSlug } from '@/lib/report-catalog';

type ReportInput = {
  personName: string;
  personBirthDate: string;
  partnerName: string;
  partnerBirthDate: string;
};

export type ShippingRateDTO = {
  id: string;
  name: string;
  amount: string;
  freeOverAmount: string | null;
  countries: string[];
};

const COUNTRIES = [
  ['MX', 'México'],
  ['US', 'Estados Unidos'],
  ['ES', 'España'],
  ['CO', 'Colombia'],
  ['AR', 'Argentina'],
  ['CL', 'Chile'],
  ['PE', 'Perú'],
] as const;

export function CheckoutForm({
  shippingRates,
  currency,
  simulate = false,
}: {
  shippingRates: ShippingRateDTO[];
  currency: string;
  simulate?: boolean;
}) {
  const { items, reconcile } = useCart();
  const show = useToast((s) => s.show);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    reconcile().then(({ removed, remapped }) => {
      if (removed > 0) {
        show(`Se quitó ${removed} producto no disponible del carrito.`);
      } else if (remapped > 0) {
        show('Actualizamos tu carrito con el catálogo.');
      }
    });
  }, [reconcile, show]);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('MX');
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [shippingRateId, setShippingRateId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [reportInputs, setReportInputs] = useState<Record<string, ReportInput>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportItems = items.filter((i) => isReportSlug(i.slug));

  function getReportInput(variantId: string): ReportInput {
    return (
      reportInputs[variantId] ?? {
        personName: `${firstName} ${lastName}`.trim(),
        personBirthDate: birthDate,
        partnerName: '',
        partnerBirthDate: '',
      }
    );
  }

  function setReportField(variantId: string, field: keyof ReportInput, value: string) {
    setReportInputs((prev) => {
      const current: ReportInput = prev[variantId] ?? {
        personName: `${firstName} ${lastName}`.trim(),
        personBirthDate: birthDate,
        partnerName: '',
        partnerBirthDate: '',
      };
      return { ...prev, [variantId]: { ...current, [field]: value } };
    });
  }

  const requiresShipping = items.some((i) => i.type === 'physical');
  const subtotalMinor = items.reduce((s, i) => s + toMinor(i.priceAmount) * i.quantity, 0);

  const applicableRates = useMemo(
    () =>
      shippingRates.filter(
        (r) => r.countries.length === 0 || r.countries.includes(country),
      ),
    [shippingRates, country],
  );

  useEffect(() => {
    if (requiresShipping && applicableRates.length > 0) {
      if (!applicableRates.some((r) => r.id === shippingRateId)) {
        setShippingRateId(applicableRates[0].id);
      }
    }
  }, [applicableRates, requiresShipping, shippingRateId]);

  function ratePriceMinor(r: ShippingRateDTO): number {
    const base = toMinor(r.amount);
    const freeOver = r.freeOverAmount ? toMinor(r.freeOverAmount) : null;
    return freeOver !== null && subtotalMinor >= freeOver ? 0 : base;
  }

  const selectedRate = applicableRates.find((r) => r.id === shippingRateId) ?? null;
  const shippingMinor = requiresShipping && selectedRate ? ratePriceMinor(selectedRate) : 0;
  const totalMinor = subtotalMinor + shippingMinor;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          phone,
          birthDate: birthDate || null,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          shippingRateId: requiresShipping ? shippingRateId : null,
          shippingAddress: requiresShipping
            ? {
                name: `${firstName} ${lastName}`.trim(),
                line1: address.line1,
                line2: address.line2 || null,
                city: address.city,
                state: address.state || null,
                postalCode: address.postalCode,
                country,
                phone: phone || null,
              }
            : null,
          discountCode: discountCode.trim() || null,
          reports: reportItems.map((i) => {
            const inp = getReportInput(i.variantId);
            const m = reportForSlug(i.slug)!;
            return {
              variantId: i.variantId,
              person: { name: inp.personName.trim(), birthDate: inp.personBirthDate },
              ...(m.needsPartner
                ? { partner: { name: inp.partnerName.trim(), birthDate: inp.partnerBirthDate } }
                : {}),
            };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo procesar el pedido.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Error de red. Intenta de nuevo.');
      setLoading(false);
    }
  }

  if (!mounted) return null;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-12 text-center">
        <p className="text-[hsl(var(--muted-foreground))]">Tu carrito está vacío.</p>
        <Link href="/" className="mt-4 inline-block underline underline-offset-4">
          Ver catálogo
        </Link>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2';

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <section className="space-y-3">
          <h2 className="font-semibold">Tus datos</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Nombre(s)"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls}
            />
            <input
              required
              placeholder="Apellidos"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputCls}
            />
          </div>
          <input
            type="email"
            required
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="tel"
              placeholder="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
            <label className="flex flex-col">
              <span className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                Fecha de nacimiento
              </span>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Recibirás la confirmación y las descargas en este correo. No necesitas cuenta.
          </p>
        </section>

        {reportItems.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="font-semibold">Datos para tus reportes</h2>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Cada reporte se genera con estos datos. Por defecto usamos tu nombre; edítalo si el
                reporte es para otra persona.
              </p>
            </div>

            {reportItems.map((item) => {
              const mapping = reportForSlug(item.slug)!;
              const inp = getReportInput(item.variantId);
              return (
                <div
                  key={item.variantId}
                  className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-4"
                >
                  <p className="text-sm font-medium text-[hsl(var(--primary))]">{item.name}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      required
                      placeholder="Nombre completo"
                      value={inp.personName}
                      onChange={(e) => setReportField(item.variantId, 'personName', e.target.value)}
                      className={inputCls}
                    />
                    <label className="flex flex-col">
                      <span className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
                        Fecha de nacimiento
                      </span>
                      <input
                        required
                        type="date"
                        value={inp.personBirthDate}
                        onChange={(e) =>
                          setReportField(item.variantId, 'personBirthDate', e.target.value)
                        }
                        className={inputCls}
                      />
                    </label>
                  </div>

                  {mapping.needsPartner && (
                    <div className="space-y-3 border-t border-[hsl(var(--border))] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        Datos de la pareja
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input
                          required
                          placeholder="Nombre completo de la pareja"
                          value={inp.partnerName}
                          onChange={(e) =>
                            setReportField(item.variantId, 'partnerName', e.target.value)
                          }
                          className={inputCls}
                        />
                        <label className="flex flex-col">
                          <span className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
                            Fecha de nacimiento de la pareja
                          </span>
                          <input
                            required
                            type="date"
                            value={inp.partnerBirthDate}
                            onChange={(e) =>
                              setReportField(item.variantId, 'partnerBirthDate', e.target.value)
                            }
                            className={inputCls}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {requiresShipping && (
          <section className="space-y-3">
            <h2 className="font-semibold">Dirección de envío</h2>
            <input
              required
              placeholder="Calle y número"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              className={inputCls}
            />
            <input
              placeholder="Interior, colonia (opcional)"
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="Ciudad"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Estado"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="Código postal"
                value={address.postalCode}
                onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                className={inputCls}
              />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputCls}
              >
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <h3 className="font-medium pt-2">Método de envío</h3>
            {applicableRates.length === 0 ? (
              <p className="text-sm text-red-500">
                No hay envío disponible para este país todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {applicableRates.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingRateId === r.id}
                        onChange={() => setShippingRateId(r.id)}
                      />
                      {r.name}
                    </span>
                    <span className="font-medium">
                      {ratePriceMinor(r) === 0
                        ? 'Gratis'
                        : formatMoney(ratePriceMinor(r), currency)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Cupón</h2>
          <input
            placeholder="Código de descuento (opcional)"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value)}
            className={inputCls}
          />
        </section>
      </div>

      <aside className="h-fit border border-[hsl(var(--border))] rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Resumen</h2>
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.variantId} className="flex justify-between gap-2">
              <span className="truncate">
                {i.name} × {i.quantity}
              </span>
              <span>{formatMoney(toMinor(i.priceAmount) * i.quantity, currency)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-[hsl(var(--border))] pt-3 space-y-1 text-sm">
          <Row label="Subtotal" value={formatMoney(subtotalMinor, currency)} />
          {requiresShipping && (
            <Row
              label="Envío"
              value={shippingMinor === 0 ? 'Gratis' : formatMoney(shippingMinor, currency)}
            />
          )}
        </div>
        <div className="border-t border-[hsl(var(--border))] pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatMoney(totalMinor, currency)}</span>
        </div>
        {discountCode.trim() && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            El cupón se valida y aplica en el pago.
          </p>
        )}

        {simulate && (
          <p className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            🧪 Modo de prueba: se simula un pago exitoso, no se cobra nada.
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || (requiresShipping && applicableRates.length === 0)}
          className="w-full rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-3 font-medium disabled:opacity-50"
        >
          {loading ? 'Procesando…' : simulate ? 'Simular compra' : 'Pagar'}
        </button>
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          {simulate ? 'Compra de prueba sin cargo.' : 'Pago seguro con Stripe.'}
        </p>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
