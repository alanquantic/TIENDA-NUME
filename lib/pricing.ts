import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { config } from './config';
import { discountCodes, products, productVariants } from './db/schema';
import { toMinor } from './money';
import { resolveShippingRate } from './shipping';
import type { CheckoutInput } from './validation';

export type PricedLine = {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  type: 'digital' | 'physical';
  image: string | null;
  unitAmountMinor: number;
  quantity: number;
  totalMinor: number;
};

export type Quote = {
  lines: PricedLine[];
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  discountCode: string | null;
  shippingMinor: number;
  shippingMethod: string | null;
  taxMinor: number;
  totalMinor: number;
  requiresShipping: boolean;
};

export class PricingError extends Error {}

/**
 * Fuente de verdad de precios. NUNCA se confía en montos del cliente: se
 * recalcula todo desde la BD. Valida existencia, estado y stock.
 */
export async function priceCart(input: CheckoutInput): Promise<Quote> {
  const variantIds = input.items.map((i) => i.variantId);

  const rows = await db
    .select({
      variantId: productVariants.id,
      variantName: productVariants.name,
      sku: productVariants.sku,
      priceAmount: productVariants.priceAmount,
      stock: productVariants.stock,
      trackInventory: productVariants.trackInventory,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      type: products.type,
      status: products.status,
      currency: products.currency,
      images: products.images,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(productVariants.id, variantIds));

  const byVariant = new Map(rows.map((r) => [r.variantId, r]));

  const lines: PricedLine[] = [];
  let subtotalMinor = 0;
  let requiresShipping = false;
  let currency: string | null = null;

  for (const item of input.items) {
    const row = byVariant.get(item.variantId);
    if (!row) throw new PricingError(`La variante ${item.variantId} no existe.`);
    if (row.status !== 'active') {
      throw new PricingError(`"${row.name}" ya no está disponible.`);
    }

    currency ??= row.currency;
    if (currency !== row.currency) {
      throw new PricingError('El carrito mezcla monedas distintas.');
    }

    if (row.type === 'physical' && row.trackInventory && row.stock < item.quantity) {
      throw new PricingError(
        `Stock insuficiente de "${row.name}" (disponible: ${row.stock}).`,
      );
    }

    const unit = toMinor(row.priceAmount);
    const total = unit * item.quantity;
    subtotalMinor += total;
    if (row.type === 'physical') requiresShipping = true;

    const images = (row.images as string[]) ?? [];
    lines.push({
      productId: row.productId,
      variantId: row.variantId,
      slug: row.slug,
      name: row.name,
      variantName: row.variantName,
      sku: row.sku,
      type: row.type,
      image: images[0] ?? null,
      unitAmountMinor: unit,
      quantity: item.quantity,
      totalMinor: total,
    });
  }

  // Descuento
  let discountMinor = 0;
  let discountCode: string | null = null;
  if (input.discountCode) {
    const applied = await applyDiscount(input.discountCode, subtotalMinor);
    discountMinor = applied.amountMinor;
    discountCode = applied.code;
  }

  const taxableBase = Math.max(0, subtotalMinor - discountMinor);

  // Envío (solo si hay físicos y se eligió tarifa)
  let shippingMinor = 0;
  let shippingMethod: string | null = null;
  if (requiresShipping && input.shippingRateId) {
    const country = input.shippingAddress?.country ?? null;
    const rate = await resolveShippingRate(input.shippingRateId, country, subtotalMinor);
    if (!rate) throw new PricingError('El método de envío seleccionado no es válido.');
    shippingMinor = rate.amountMinor;
    shippingMethod = rate.name;
  } else if (requiresShipping && !input.shippingRateId) {
    throw new PricingError('Falta seleccionar un método de envío.');
  }

  // Sin impuestos.
  const taxMinor = 0;

  const totalMinor = taxableBase + shippingMinor;

  return {
    lines,
    currency: currency ?? config.currency,
    subtotalMinor,
    discountMinor,
    discountCode,
    shippingMinor,
    shippingMethod,
    taxMinor,
    totalMinor,
    requiresShipping,
  };
}

async function applyDiscount(
  code: string,
  subtotalMinor: number,
): Promise<{ code: string; amountMinor: number }> {
  const normalized = code.trim().toUpperCase();
  const [row] = await db
    .select()
    .from(discountCodes)
    .where(and(eq(discountCodes.code, normalized), eq(discountCodes.isActive, true)))
    .limit(1);

  if (!row) throw new PricingError('El cupón no es válido.');
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    throw new PricingError('El cupón expiró.');
  }
  if (row.maxRedemptions != null && row.timesRedeemed >= row.maxRedemptions) {
    throw new PricingError('El cupón alcanzó su límite de usos.');
  }
  if (row.minSubtotal && subtotalMinor < toMinor(row.minSubtotal)) {
    throw new PricingError('El subtotal no alcanza el mínimo del cupón.');
  }

  let amountMinor = 0;
  if (row.type === 'percent') {
    amountMinor = Math.round((subtotalMinor * parseFloat(row.value)) / 100);
  } else {
    amountMinor = toMinor(row.value);
  }
  amountMinor = Math.min(amountMinor, subtotalMinor);
  return { code: normalized, amountMinor };
}
