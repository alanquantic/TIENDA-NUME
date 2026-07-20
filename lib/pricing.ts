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
  /** Atributos de la variante (p. ej. { color: 'morado' }) — snapshot de catálogo. */
  variantAttributes: Record<string, unknown>;
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
      variantAttributes: productVariants.attributes,
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
      maxPerOrder: products.maxPerOrder,
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
      variantAttributes: (row.variantAttributes as Record<string, unknown>) ?? {},
      sku: row.sku,
      type: row.type,
      image: images[0] ?? null,
      unitAmountMinor: unit,
      quantity: item.quantity,
      totalMinor: total,
    });
  }

  // Límite de unidades por pedido (agregado por PRODUCTO, no por variante:
  // así no se burla el tope comprando 1 de cada variante).
  const qtyByProduct = new Map<string, number>();
  for (const line of lines) {
    qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity);
  }
  for (const [productId, qty] of qtyByProduct) {
    const row = rows.find((r) => r.productId === productId);
    const max = row?.maxPerOrder;
    if (max != null && qty > max) {
      throw new PricingError(
        `Solo puedes comprar ${max} ${max === 1 ? 'unidad' : 'unidades'} de "${row?.name}" por pedido.`,
      );
    }
  }

  // Descuento
  let discountMinor = 0;
  let discountCode: string | null = null;
  if (input.discountCode) {
    const applied = await applyDiscount(input.discountCode, subtotalMinor, lines);
    discountMinor = applied.amountMinor;
    discountCode = applied.code;
  }

  const taxableBase = Math.max(0, subtotalMinor - discountMinor);

  // Envío (solo si hay físicos y se eligió tarifa)
  let shippingMinor = 0;
  let shippingMethod: string | null = null;
  const shippingCountry = input.shippingAddress?.country ?? null;
  if (requiresShipping && shippingCountry?.toUpperCase() !== 'MX') {
    throw new PricingError('Por el momento, los productos físicos solo se envían dentro de México.');
  }
  if (requiresShipping && input.shippingRateId) {
    const rate = await resolveShippingRate(input.shippingRateId, shippingCountry, subtotalMinor);
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
  lines: PricedLine[],
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
  // El mínimo siempre se evalúa contra el subtotal del carrito.
  if (row.minSubtotal && subtotalMinor < toMinor(row.minSubtotal)) {
    throw new PricingError('El subtotal no alcanza el mínimo del cupón.');
  }

  // Base sobre la que aplica: todo el carrito, o solo las líneas del producto.
  let baseMinor = subtotalMinor;
  if (row.scope === 'product') {
    if (!row.productId) {
      throw new PricingError('El cupón no está configurado correctamente.');
    }
    baseMinor = lines
      .filter((l) => l.productId === row.productId)
      .reduce((sum, l) => sum + l.totalMinor, 0);
    if (baseMinor === 0) {
      throw new PricingError('El cupón no aplica a los productos de tu carrito.');
    }
  }

  let amountMinor = 0;
  if (row.type === 'percent') {
    amountMinor = Math.round((baseMinor * parseFloat(row.value)) / 100);
  } else {
    amountMinor = toMinor(row.value);
  }
  // Nunca descuenta más que su base (ni deja el total negativo).
  amountMinor = Math.min(amountMinor, baseMinor);
  return { code: normalized, amountMinor };
}
