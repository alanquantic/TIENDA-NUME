'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { formatMoney, toMinor } from '@/lib/money';
import { reportsForSlug, type ReportKey } from '@/lib/report-catalog';
import { REGIMEN_FISCAL, USO_CFDI } from '@/lib/sat-catalog';

type BillingInput = {
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  usoCfdi: string;
  postalCode: string;
  email: string;
};

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
] as const;

const MEXICO_STATES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
] as const;

export function CheckoutForm({
  shippingRates,
  physicalProductSlugs,
  currency,
  simulate = false,
}: {
  shippingRates: ShippingRateDTO[];
  physicalProductSlugs: string[];
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
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [billing, setBilling] = useState<BillingInput>({
    rfc: '',
    razonSocial: '',
    regimenFiscal: '',
    usoCfdi: '',
    postalCode: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Una sección por (variante del carrito × reporte generado). Dos productos
   * que compartan un reporte (Membresía y Kit → "¿Quién soy?") aparecen como
   * secciones separadas: el comprador puede regalar uno a otra persona y
   * capturar datos distintos. Los estáticos (agenda/planeador) no piden nada.
   */
  const reportSections = useMemo(() => {
    const sections: {
      sectionKey: string;
      variantId: string;
      reportKey: ReportKey;
      label: string;
      needsPartner: boolean;
      from: string;
    }[] = [];
    for (const item of items) {
      for (const m of reportsForSlug(item.slug)) {
        if (m.kind !== 'generated') continue;
        sections.push({
          sectionKey: `${item.variantId}:${m.report}`,
          variantId: item.variantId,
          reportKey: m.report,
          label: m.label,
          needsPartner: m.needsPartner,
          from: item.name,
        });
      }
    }
    return sections;
  }, [items]);

  function blankReportInput(): ReportInput {
    return {
      personName: `${firstName} ${lastName}`.trim(),
      personBirthDate: birthDate,
      partnerName: '',
      partnerBirthDate: '',
    };
  }

  function getReportInput(key: string): ReportInput {
    return reportInputs[key] ?? blankReportInput();
  }

  function setReportField(key: string, field: keyof ReportInput, value: string) {
    setReportInputs((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? blankReportInput()), [field]: value },
    }));
  }

  const physicalSlugs = useMemo(
    () => new Set(physicalProductSlugs),
    [physicalProductSlugs],
  );
  const requiresShipping = items.some(
    (item) => item.type === 'physical' || physicalSlugs.has(item.slug),
  );
  const subtotalMinor = items.reduce((s, i) => s + toMinor(i.priceAmount) * i.quantity, 0);

  const applicableRates = useMemo(
    () =>
      shippingRates.filter(
        (rate) => rate.countries.includes(country),
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
          reports: reportSections.map((s) => {
            const inp = getReportInput(s.sectionKey);
            return {
              variantId: s.variantId,
              reportKey: s.reportKey,
              person: { name: inp.personName.trim(), birthDate: inp.personBirthDate },
              ...(s.needsPartner
                ? { partner: { name: inp.partnerName.trim(), birthDate: inp.partnerBirthDate } }
                : {}),
            };
          }),
          requiresInvoice: wantsInvoice,
          billingInfo: wantsInvoice
            ? {
                rfc: billing.rfc.trim(),
                razonSocial: billing.razonSocial.trim(),
                regimenFiscal: billing.regimenFiscal,
                usoCfdi: billing.usoCfdi,
                postalCode: billing.postalCode.trim(),
                email: billing.email.trim() || email,
              }
            : null,
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
  const labelCls = 'mb-1 text-xs text-[hsl(var(--muted-foreground))]';

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <section className="space-y-3">
          <h2 className="font-semibold">Tus datos</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col">
              <span className={labelCls}>
                Nombre(s) <Req />
              </span>
              <input
                required
                placeholder="Nombre(s)"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col">
              <span className={labelCls}>
                Apellidos <Req />
              </span>
              <input
                required
                placeholder="Apellidos"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <label className="flex flex-col">
            <span className={labelCls}>
              Correo <Req />
            </span>
            <input
              type="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col">
              <span className={labelCls}>
                Teléfono <Req />
              </span>
              <input
                required
                type="tel"
                placeholder="Teléfono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col">
              <span className={labelCls}>Fecha de nacimiento</span>
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

        {reportSections.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="font-semibold">Datos para tus reportes</h2>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Cada reporte se genera por separado: puedes usar una persona distinta en cada uno.
                Por defecto usamos tu nombre.
              </p>
            </div>

            {reportSections.map((s) => {
              const inp = getReportInput(s.sectionKey);
              return (
                <div
                  key={s.sectionKey}
                  className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--primary))]">{s.label}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Incluido en: {s.from}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col">
                      <span className={labelCls}>
                        Nombre completo <Req />
                      </span>
                      <input
                        required
                        placeholder="Nombre completo"
                        value={inp.personName}
                        onChange={(e) =>
                          setReportField(s.sectionKey, 'personName', e.target.value)
                        }
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className={labelCls}>
                        Fecha de nacimiento <Req />
                      </span>
                      <input
                        required
                        type="date"
                        value={inp.personBirthDate}
                        onChange={(e) =>
                          setReportField(s.sectionKey, 'personBirthDate', e.target.value)
                        }
                        className={inputCls}
                      />
                    </label>
                  </div>

                  {s.needsPartner && (
                    <div className="space-y-3 border-t border-[hsl(var(--border))] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        Datos de la pareja
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col">
                          <span className={labelCls}>
                            Nombre completo de la pareja <Req />
                          </span>
                          <input
                            required
                            placeholder="Nombre completo de la pareja"
                            value={inp.partnerName}
                            onChange={(e) =>
                              setReportField(s.sectionKey, 'partnerName', e.target.value)
                            }
                            className={inputCls}
                          />
                        </label>
                        <label className="flex flex-col">
                          <span className={labelCls}>
                            Fecha de nacimiento de la pareja <Req />
                          </span>
                          <input
                            required
                            type="date"
                            value={inp.partnerBirthDate}
                            onChange={(e) =>
                              setReportField(s.sectionKey, 'partnerBirthDate', e.target.value)
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
            <label className="flex flex-col">
              <span className={labelCls}>
                Calle y número <Req />
              </span>
              <input
                required
                placeholder="Calle y número"
                value={address.line1}
                onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                className={inputCls}
              />
            </label>
            <input
              placeholder="Interior, colonia (opcional)"
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col">
                <span className={labelCls}>
                  Ciudad <Req />
                </span>
                <input
                  required
                  placeholder="Ciudad"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col">
                <span className={labelCls}>
                  Estado <Req />
                </span>
                <select
                  required
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  className={inputCls}
                >
                  <option value="" disabled>
                    Selecciona tu estado
                  </option>
                  {MEXICO_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col">
                <span className={labelCls}>
                  Código postal <Req />
                </span>
                <input
                  required
                  placeholder="Código postal"
                  value={address.postalCode}
                  onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col">
                <span className={labelCls}>
                  País <Req />
                </span>
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
              </label>
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

        <section className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wantsInvoice}
              onChange={(e) => setWantsInvoice(e.target.checked)}
            />
            <span className="font-semibold">Requiero factura (CFDI)</span>
          </label>

          {wantsInvoice && (
            <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Datos fiscales del receptor. Deben coincidir con tu Constancia de Situación Fiscal.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col">
                  <span className={labelCls}>
                    RFC <Req />
                  </span>
                  <input
                    required
                    placeholder="RFC"
                    value={billing.rfc}
                    onChange={(e) =>
                      setBilling({ ...billing, rfc: e.target.value.toUpperCase() })
                    }
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col">
                  <span className={labelCls}>
                    Razón social / Nombre fiscal <Req />
                  </span>
                  <input
                    required
                    placeholder="Razón social / Nombre fiscal"
                    value={billing.razonSocial}
                    onChange={(e) => setBilling({ ...billing, razonSocial: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col">
                  <span className={labelCls}>
                    Régimen fiscal <Req />
                  </span>
                  <select
                    required
                    value={billing.regimenFiscal}
                    onChange={(e) => setBilling({ ...billing, regimenFiscal: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Selecciona…</option>
                    {REGIMEN_FISCAL.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col">
                  <span className={labelCls}>
                    Uso de CFDI <Req />
                  </span>
                  <select
                    required
                    value={billing.usoCfdi}
                    onChange={(e) => setBilling({ ...billing, usoCfdi: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Selecciona…</option>
                    {USO_CFDI.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col">
                  <span className={labelCls}>
                    Código postal fiscal <Req />
                  </span>
                  <input
                    required
                    inputMode="numeric"
                    placeholder="Código postal fiscal"
                    value={billing.postalCode}
                    onChange={(e) => setBilling({ ...billing, postalCode: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <input
                  type="email"
                  placeholder="Correo para la factura (opcional)"
                  value={billing.email}
                  onChange={(e) => setBilling({ ...billing, email: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          )}
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

function Req() {
  return <span className="text-red-500">*</span>;
}
