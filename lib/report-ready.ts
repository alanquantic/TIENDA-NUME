import { eq } from 'drizzle-orm';
import { db } from './db';
import { sendReportReady } from './email';
import { generatedReports, orders } from './db/schema';

type StoredReportInput = {
  kind?: 'generated' | 'static';
  engine?: 'legacy' | 'ai';
  person?: { name: string; birthDate: string } | null;
  partner?: { name: string; birthDate: string } | null;
  variant?: string | null;
  instance?: string | null;
  jobId?: string | null;
  previewUrl?: string | null;
  jsonUrl?: string | null;
};

export async function markGeneratedReportReady(input: {
  rowId: string;
  pdfUrl: string;
  previewUrl?: string | null;
  jsonUrl?: string | null;
}): Promise<{ notified: boolean }> {
  const [row] = await db
    .select({
      id: generatedReports.id,
      orderId: generatedReports.orderId,
      productName: generatedReports.productName,
      status: generatedReports.status,
      url: generatedReports.url,
      input: generatedReports.input,
    })
    .from(generatedReports)
    .where(eq(generatedReports.id, input.rowId))
    .limit(1);

  if (!row) throw new Error(`Generated report ${input.rowId} no encontrado`);

  const storedInput = (row.input ?? {}) as StoredReportInput;
  const alreadyReady = row.status === 'ready' && row.url === input.pdfUrl;

  await db
    .update(generatedReports)
    .set({
      status: 'ready',
      url: input.pdfUrl,
      error: null,
      input: {
        ...storedInput,
        previewUrl: input.previewUrl ?? null,
        jsonUrl: input.jsonUrl ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(generatedReports.id, input.rowId));

  if (alreadyReady) {
    return { notified: false };
  }

  const [order] = await db
    .select({
      customerEmail: orders.customerEmail,
      customerFirstName: orders.customerFirstName,
      customerLastName: orders.customerLastName,
    })
    .from(orders)
    .where(eq(orders.id, row.orderId))
    .limit(1);

  if (!order) {
    return { notified: false };
  }

  await sendReportReady({
    customerEmail: order.customerEmail,
    customerName: `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim(),
    reportName: row.productName ?? 'Reporte',
    pdfUrl: input.pdfUrl,
    previewUrl: input.previewUrl ?? null,
  });

  return { notified: true };
}
