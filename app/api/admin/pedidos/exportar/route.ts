import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { parseOrderFilters } from '@/lib/admin/order-filters';
import { itemsForOrders } from '@/lib/admin/order-items';
import { ITEM_KIND_LABEL, isTestOrder } from '@/lib/admin/order-kinds';
import { orderConditions } from '@/lib/admin/order-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tope de filas por archivo; con filtros de fecha sobra. */
const MAX_ROWS = 10000;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  fulfilled: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial',
};

const fmtDate = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  // Evita que Excel interprete celdas que empiezan con =, +, - o @ como fórmulas.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV de los pedidos con los mismos filtros que la lista del admin. */
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const filters = parseOrderFilters(params);
  if (filters.error) return NextResponse.json({ error: filters.error }, { status: 400 });

  const rows = await db
    .select()
    .from(orders)
    .where(orderConditions(filters))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(MAX_ROWS);
  const itemsByOrder = await itemsForOrders(rows.map((o) => o.id));

  const header = [
    'Pedido', 'Fecha', 'Estado', 'Prueba', 'Cliente', 'Correo', 'Teléfono', 'Pasarela',
    'Cupón', 'Moneda', 'Subtotal', 'Descuento', 'Envío', 'Impuestos', 'Total',
    'Tipos', 'Categorías', 'Productos',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const o of rows) {
    const items = itemsByOrder.get(o.id) ?? [];
    lines.push([
      o.number,
      fmtDate.format(o.createdAt),
      STATUS_LABEL[o.status] ?? o.status,
      isTestOrder(o) ? 'Sí' : 'No',
      `${o.customerFirstName ?? ''} ${o.customerLastName ?? ''}`.trim(),
      o.customerEmail,
      o.customerPhone,
      o.provider,
      o.discountCode,
      o.currency,
      o.subtotalAmount,
      o.discountAmount,
      o.shippingAmount,
      o.taxAmount,
      o.totalAmount,
      [...new Set(items.map((i) => ITEM_KIND_LABEL[i.kind]))].join(' | '),
      [...new Set(items.map((i) => i.categoryName ?? 'Sin categoría'))].join(' | '),
      items.map((i) => `${i.name}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity}`).join(' | '),
    ].map(csvCell).join(','));
  }

  const suffix = filters.month || [filters.from, filters.to].filter(Boolean).join('_a_') || 'todos';
  // BOM para que Excel abra los acentos en UTF-8.
  return new NextResponse(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pedidos-${suffix}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
