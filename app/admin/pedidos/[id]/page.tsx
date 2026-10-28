import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { adminHref } from '@/lib/admin-path';
import { db } from '@/lib/db';
import {
  digitalAssets,
  downloadGrants,
  emailMessages,
  generatedReports,
  orders,
} from '@/lib/db/schema';
import {
  EMAIL_KIND_LABEL,
  EMAIL_STATUS_LABEL,
  emailStatusClass,
  formatUsd,
} from '@/lib/admin/email-labels';
import { itemsForOrders } from '@/lib/admin/order-items';
import { ITEM_KIND_LABEL, isTestOrder } from '@/lib/admin/order-kinds';
import { formatDecimal } from '@/lib/money';
import { REGIMEN_FISCAL, USO_CFDI } from '@/lib/sat-catalog';

export const dynamic = 'force-dynamic';

const fmtDate = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});
const fmtShort = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

const REPORT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  queued: 'En cola',
  running: 'Generando',
  ready: 'Listo',
  error: 'Error',
  skipped: 'Omitido',
  failed: 'Fallido',
};

function reportStatusClass(status: string): string {
  if (status === 'ready') return 'text-green-600';
  if (status === 'error' || status === 'failed') return 'text-red-500';
  return 'text-amber-600';
}

const REGIMEN_LABEL = new Map(REGIMEN_FISCAL);
const USO_LABEL = new Map(USO_CFDI);

type Address = {
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string | null;
  postalCode?: string;
  country?: string;
  phone?: string | null;
};

type Billing = {
  rfc?: string;
  razonSocial?: string;
  regimenFiscal?: string;
  usoCfdi?: string;
  postalCode?: string;
  email?: string | null;
};

export default async function OrderDetail({ params }: { params: { id: string } }) {
  const [order] = await db.select().from(orders).where(eq(orders.id, params.id)).limit(1);
  if (!order) notFound();

  const [itemsByOrder, reports, emails] = await Promise.all([
    itemsForOrders([order.id]),
    db
      .select()
      .from(generatedReports)
      .where(eq(generatedReports.orderId, order.id))
      .orderBy(asc(generatedReports.createdAt)),
    db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.orderId, order.id))
      .orderBy(desc(emailMessages.sentAt)),
  ]);
  const items = itemsByOrder.get(order.id) ?? [];
  const withUsage = reports.filter((r) => r.usage);
  const tokenCost = withUsage.reduce((sum, r) => sum + (r.usage?.tokenCostUsd ?? 0), 0);
  const productionCost = withUsage.reduce((sum, r) => sum + (r.usage?.productionCostUsd ?? 0), 0);
  const downloads = await db
    .select({ token: downloadGrants.token, fileName: digitalAssets.fileName, used: downloadGrants.downloadsUsed })
    .from(downloadGrants)
    .innerJoin(digitalAssets, eq(downloadGrants.digitalAssetId, digitalAssets.id))
    .where(eq(downloadGrants.orderId, order.id));

  const addr = (order.shippingAddress ?? null) as Address | null;
  const billing = (order.billingInfo ?? null) as Billing | null;

  return (
    <div>
      <Link href={adminHref('/pedidos')} className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">
        ← Pedidos
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{order.number}</h1>
        <div className="flex items-center gap-2">
          {isTestOrder(order) && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm text-amber-600">
              Prueba
            </span>
          )}
          <span className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-sm">
            {order.status}
          </span>
        </div>
      </div>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
        {fmtDate.format(order.createdAt)}
        {order.paidAt ? ` · pagado ${fmtDate.format(order.paidAt)}` : ''}
      </p>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <Card title="Cliente">
          <Row k="Nombre" v={`${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || '—'} />
          <Row k="Correo" v={order.customerEmail} />
          <Row k="Teléfono" v={order.customerPhone ?? '—'} />
          <Row k="Nacimiento" v={order.customerBirthDate ?? '—'} />
        </Card>

        <Card title="Pago">
          <Row k="Proveedor" v={order.provider} />
          <Row k="Checkout ID" v={order.externalCheckoutId ?? '—'} />
          <Row k="Payment Intent" v={order.externalPaymentIntentId ?? '—'} />
          <Row k="Cupón" v={order.discountCode ?? '—'} />
        </Card>

        {order.requiresShipping && (
          <Card title="Envío">
            <Row k="Método" v={order.shippingMethod ?? '—'} />
            {addr && (
              <p className="text-sm mt-2">
                {addr.name}
                <br />
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ''}
                <br />
                {addr.city}
                {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
                <br />
                {addr.country}
              </p>
            )}
          </Card>
        )}

        {order.requiresInvoice && (
          <Card title="Facturación (CFDI)">
            {billing ? (
              <>
                <Row k="RFC" v={billing.rfc ?? '—'} />
                <Row k="Razón social" v={billing.razonSocial ?? '—'} />
                <Row
                  k="Régimen"
                  v={
                    billing.regimenFiscal
                      ? (REGIMEN_LABEL.get(billing.regimenFiscal) ?? billing.regimenFiscal)
                      : '—'
                  }
                />
                <Row
                  k="Uso CFDI"
                  v={billing.usoCfdi ? (USO_LABEL.get(billing.usoCfdi) ?? billing.usoCfdi) : '—'}
                />
                <Row k="CP fiscal" v={billing.postalCode ?? '—'} />
                <Row k="Correo factura" v={billing.email || order.customerEmail} />
              </>
            ) : (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Solicitó factura, sin datos fiscales registrados.
              </p>
            )}
          </Card>
        )}

        {reports.length > 0 && (
          <Card title="Reportes" wide>
            <ul className="divide-y divide-[hsl(var(--border))] text-sm">
              {reports.map((r) => {
                const previewUrl = (r.input as { previewUrl?: string | null } | null)?.previewUrl;
                return (
                  <li key={r.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{r.productName ?? r.reportKey}</span>
                      <span className={reportStatusClass(r.status)}>
                        {REPORT_STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline">
                          Abrir PDF ↗
                        </a>
                      ) : (
                        <span>Sin enlace todavía</span>
                      )}
                      {previewUrl && (
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline">
                          Vista web ↗
                        </a>
                      )}
                      {r.usage && (
                        <span>
                          {r.usage.totalTokens != null && `${r.usage.totalTokens.toLocaleString('es-MX')} tokens · `}
                          Tokens {formatUsd(r.usage.tokenCostUsd)} · Producción {formatUsd(r.usage.productionCostUsd)}
                          {r.usage.model && ` · ${r.usage.model}`}
                        </span>
                      )}
                      {r.error && r.status !== 'ready' && <span className="text-red-500">{r.error}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {withUsage.length > 0 && (
              <p className="mt-3 border-t border-[hsl(var(--border))] pt-3 text-sm">
                Costo IA del pedido: tokens <strong>{formatUsd(tokenCost)}</strong> · producción{' '}
                <strong>{formatUsd(productionCost)}</strong>
              </p>
            )}
          </Card>
        )}

        <Card title="Correos" wide>
          {emails.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Sin correos registrados. El registro empezó con esta versión del admin.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))] text-sm">
              {emails.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-medium">{EMAIL_KIND_LABEL[m.kind] ?? m.kind}</div>
                    <div className="break-all text-xs text-[hsl(var(--muted-foreground))]">
                      {m.toEmail} · {fmtShort.format(m.sentAt)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className={emailStatusClass(m.status)}>{EMAIL_STATUS_LABEL[m.status] ?? m.status}</div>
                    <div className="text-[hsl(var(--muted-foreground))]">
                      {m.openedAt ? `Abierto ${fmtShort.format(m.openedAt)}` : 'Sin abrir'}
                      {' · '}
                      {m.clickedAt ? `Clic ${fmtShort.format(m.clickedAt)}` : 'Sin clic'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {downloads.length > 0 && (
          <Card title="Descargas">
            <ul className="space-y-1 text-sm">
              {downloads.map((d) => (
                <li key={d.token} className="flex justify-between">
                  <span>{d.fileName}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{d.used} descargas</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="mt-6 border border-[hsl(var(--border))] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3">
                  {i.name}
                  {i.variantName ? ` — ${i.variantName}` : ''}
                  <span className="text-[hsl(var(--muted-foreground))]"> × {i.quantity}</span>
                  <span className="ml-2 rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {ITEM_KIND_LABEL[i.kind]}
                  </span>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {i.categoryName ?? 'Sin categoría'}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{formatDecimal(i.totalAmount, order.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[hsl(var(--border))]">
            <FootRow k="Subtotal" v={formatDecimal(order.subtotalAmount, order.currency)} />
            {parseFloat(order.discountAmount) > 0 && (
              <FootRow k="Descuento" v={`- ${formatDecimal(order.discountAmount, order.currency)}`} />
            )}
            {order.requiresShipping && (
              <FootRow k="Envío" v={formatDecimal(order.shippingAmount, order.currency)} />
            )}
            {parseFloat(order.taxAmount) > 0 && (
              <FootRow k="Impuestos" v={formatDecimal(order.taxAmount, order.currency)} />
            )}
            <FootRow k="Total" v={formatDecimal(order.totalAmount, order.currency)} bold />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`border border-[hsl(var(--border))] rounded-xl p-5${wide ? ' md:col-span-2' : ''}`}>
      <h2 className="font-medium mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-0.5">
      <span className="text-[hsl(var(--muted-foreground))]">{k}</span>
      <span className="text-right break-all">{v}</span>
    </div>
  );
}

function FootRow({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <tr className={bold ? 'font-semibold' : ''}>
      <td className="px-4 py-2 text-right text-[hsl(var(--muted-foreground))]">{k}</td>
      <td className="px-4 py-2 text-right w-40">{v}</td>
    </tr>
  );
}
