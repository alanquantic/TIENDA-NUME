import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  digitalAssets,
  downloadGrants,
  orderItems,
  orders,
} from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import { REGIMEN_FISCAL, USO_CFDI } from '@/lib/sat-catalog';

export const dynamic = 'force-dynamic';

const fmtDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' });

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

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const downloads = await db
    .select({ token: downloadGrants.token, fileName: digitalAssets.fileName, used: downloadGrants.downloadsUsed })
    .from(downloadGrants)
    .innerJoin(digitalAssets, eq(downloadGrants.digitalAssetId, digitalAssets.id))
    .where(eq(downloadGrants.orderId, order.id));

  const addr = (order.shippingAddress ?? null) as Address | null;
  const billing = (order.billingInfo ?? null) as Billing | null;

  return (
    <div>
      <Link href="/admin/pedidos" className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">
        ← Pedidos
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{order.number}</h1>
        <span className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-sm">
          {order.status}
        </span>
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
                  <span className="ml-2 text-xs uppercase text-[hsl(var(--muted-foreground))]">
                    {i.type === 'digital' ? 'digital' : 'físico'}
                  </span>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[hsl(var(--border))] rounded-xl p-5">
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
