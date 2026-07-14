import { eq } from 'drizzle-orm';
import { db } from './db';
import { shippingRates, type ShippingRate } from './db/schema';
import { toMinor } from './money';

export type ShippingOption = {
  id: string;
  name: string;
  amountMinor: number;
};

function isApplicable(rate: ShippingRate, country: string | null): boolean {
  const countries = (rate.countries as string[]) ?? [];
  if (countries.length === 0) return true; // tarifa global
  return country != null && countries.includes(country.toUpperCase());
}

function priceFor(rate: ShippingRate, subtotalMinor: number): number {
  const base = toMinor(rate.amount);
  const freeOver = rate.freeOverAmount != null ? toMinor(rate.freeOverAmount) : null;
  if (freeOver != null && subtotalMinor >= freeOver) return 0;
  return base;
}

/** Opciones de envío aplicables a un país y subtotal dados. */
export async function getShippingOptions(
  country: string | null,
  subtotalMinor: number,
): Promise<ShippingOption[]> {
  const rates = await db
    .select()
    .from(shippingRates)
    .where(eq(shippingRates.isActive, true));

  return rates
    .filter((r) => isApplicable(r, country))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => ({ id: r.id, name: r.name, amountMinor: priceFor(r, subtotalMinor) }));
}

/** Resuelve una tarifa concreta (para el cálculo autoritativo en checkout). */
export async function resolveShippingRate(
  rateId: string,
  country: string | null,
  subtotalMinor: number,
): Promise<ShippingOption | null> {
  const [rate] = await db
    .select()
    .from(shippingRates)
    .where(eq(shippingRates.id, rateId))
    .limit(1);

  if (!rate || !rate.isActive || !isApplicable(rate, country)) return null;
  return { id: rate.id, name: rate.name, amountMinor: priceFor(rate, subtotalMinor) };
}
