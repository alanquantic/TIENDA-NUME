import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { desc, inArray, sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  digitalAssets,
  downloadGrants,
  generatedReports,
  orderItems,
  orders,
} from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import { displayNameOf, type NumeMembershipTier } from '@/lib/nume-auth';
import { getSessionUser } from '@/lib/nume-session';
import { NUME_SITE_URL } from '@/lib/nume-site';
import { AccountLogoutButton } from '@/components/account-logout-button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mi cuenta' };

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  fulfilled: 'Completado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  fulfilled: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  refunded: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  partially_refunded: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
};

const MEMBERSHIP_LABELS: Record<NumeMembershipTier, string | null> = {
  none: null,
  membresia_180: 'Membresía 180',
  membresia_365: 'Membresía 365',
};

function formatDate(value: Date | string | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

type StoredReportInput = { previewUrl?: string | null };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect('/cuenta/login');

  const email = user.email.trim().toLowerCase();

  const myOrders = await db
    .select()
    .from(orders)
    .where(sql`lower(${orders.customerEmail}) = ${email}`)
    .orderBy(desc(orders.createdAt));

  const orderIds = myOrders.map((order) => order.id);

  const [items, downloads, reports] = orderIds.length
    ? await Promise.all([
        db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
        db
          .select({
            orderId: downloadGrants.orderId,
            token: downloadGrants.token,
            fileName: digitalAssets.fileName,
          })
          .from(downloadGrants)
          .innerJoin(digitalAssets, eq(downloadGrants.digitalAssetId, digitalAssets.id))
          .where(inArray(downloadGrants.orderId, orderIds)),
        db
          .select({
            orderId: generatedReports.orderId,
            name: generatedReports.productName,
            url: generatedReports.url,
            status: generatedReports.status,
            input: generatedReports.input,
          })
          .from(generatedReports)
          .where(inArray(generatedReports.orderId, orderIds)),
      ])
    : [[], [], []];

  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const downloadsByOrder = new Map<string, typeof downloads>();
  for (const download of downloads) {
    const list = downloadsByOrder.get(download.orderId) ?? [];
    list.push(download);
    downloadsByOrder.set(download.orderId, list);
  }

  const reportsByOrder = new Map<string, typeof reports>();
  for (const report of reports) {
    const list = reportsByOrder.get(report.orderId) ?? [];
    list.push(report);
    reportsByOrder.set(report.orderId, list);
  }

  // /auth/me no expone metadata; si no hay nombre ahí, se toma del pedido
  // más reciente que capturó nombre en el checkout.
  const nameFromOrders =
    myOrders
      .map((order) =>
        [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ').trim(),
      )
      .find(Boolean) ?? null;
  const name = displayNameOf(user) ?? nameFromOrders;
  const membershipLabel = user.has_active_membership
    ? MEMBERSHIP_LABELS[user.current_membership]
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hola{name ? `, ${name}` : ''} 👋
          </h1>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">{user.email}</p>
          {membershipLabel && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary-soft))] px-3 py-1 text-sm font-medium text-[hsl(var(--primary))]">
              ✦ {membershipLabel} · vence el {formatDate(user.membership_expires_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${NUME_SITE_URL}/perfil`}
            className="rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium transition hover:bg-[hsl(var(--muted))]"
          >
            Administrar mi cuenta
          </a>
          <AccountLogoutButton />
        </div>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Mis pedidos</h2>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Compras realizadas en la tienda con el correo {user.email}.
      </p>

      {myOrders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[hsl(var(--border))] px-6 py-12 text-center">
          <p className="text-lg font-medium">Aún no tienes pedidos</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[hsl(var(--muted-foreground))]">
            Cuando compres en la tienda con este correo, aquí verás tu historial con
            descargas y reportes.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-90"
          >
            Explorar la tienda
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {myOrders.map((order) => {
            const orderItemsList = itemsByOrder.get(order.id) ?? [];
            const orderDownloads = downloadsByOrder.get(order.id) ?? [];
            const orderReports = reportsByOrder.get(order.id) ?? [];
            const readyReports = orderReports.filter(
              (report) => report.status === 'ready' && report.url,
            );
            const pendingReports = orderReports.filter(
              (report) => report.status === 'pending',
            );

            return (
              <li
                key={order.id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.number}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatDate(order.paidAt ?? order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] ?? 'bg-[hsl(var(--muted))]'}`}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <span className="font-semibold">
                      {formatDecimal(order.totalAmount, order.currency)}
                    </span>
                  </div>
                </div>

                {orderItemsList.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-[hsl(var(--border))] pt-3 text-sm">
                    {orderItemsList.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3">
                        <span>
                          {item.name}
                          {item.variantName ? ` — ${item.variantName}` : ''}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        </span>
                        <span className="shrink-0 text-[hsl(var(--muted-foreground))]">
                          {formatDecimal(item.totalAmount, order.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {(orderDownloads.length > 0 || readyReports.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[hsl(var(--border))] pt-3">
                    {orderDownloads.map((download) => (
                      <a
                        key={download.token}
                        href={`/api/descargas/${download.token}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium transition hover:bg-[hsl(var(--muted))]"
                      >
                        ⬇️ {download.fileName}
                      </a>
                    ))}
                    {readyReports.map((report, index) => {
                      const previewUrl =
                        ((report.input ?? {}) as StoredReportInput).previewUrl ?? null;
                      return (
                        <span key={`${report.name}-${index}`} className="inline-flex gap-2">
                          {previewUrl && (
                            <a
                              href={previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium transition hover:bg-[hsl(var(--muted))]"
                            >
                              Ver {report.name ?? 'reporte'}
                            </a>
                          )}
                          <a
                            href={report.url as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium transition hover:bg-[hsl(var(--muted))]"
                          >
                            📄 {report.name ?? 'Reporte'} (PDF)
                          </a>
                        </span>
                      );
                    })}
                  </div>
                )}

                {pendingReports.length > 0 && (
                  <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                    ⏳ {pendingReports.length === 1 ? 'Un reporte se está generando' : `${pendingReports.length} reportes se están generando`}
                    ; te llegarán por correo en cuanto estén listos.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">
        ¿Compraste con otro correo y no ves tu pedido? Escríbenos y lo vinculamos a tu
        cuenta.
      </p>
    </div>
  );
}
