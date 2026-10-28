import type { Metadata } from 'next';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, products, shippingRates } from '@/lib/db/schema';
import { config } from '@/lib/config';
import { getSessionUser } from '@/lib/nume-session';
import { isEmailVerified, profileOf } from '@/lib/nume-auth';
import { getAvailablePaymentMethods } from '@/lib/payments/settings';
import {
  CheckoutForm,
  type CheckoutPrefill,
  type ShippingRateDTO,
} from '@/components/checkout-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout' };

/**
 * Con sesión iniciada, precarga los datos del cliente: el correo viene de la
 * sesión; nombre completo, teléfono y fecha, del perfil de la cuenta nume (nunca
 * el apodo, porque el nombre también llena los datos de los reportes) y, campo
 * por campo, del pedido más reciente con ese correo cuando el perfil no los
 * tiene. Todo queda editable: sigue siendo checkout de invitado. Solo se
 * precargan datos si el correo está confirmado.
 */
async function prefillForSession(): Promise<CheckoutPrefill | null> {
  const user = await getSessionUser();
  if (!user) return null;

  // Con el correo sin confirmar solo se precarga el correo de la sesión: el
  // resto sale de pedidos anteriores y podría ser de otra persona.
  if (!isEmailVerified(user)) {
    return { email: user.email, firstName: '', lastName: '', phone: '', birthDate: '' };
  }

  const [lastOrder] = await db
    .select({
      firstName: orders.customerFirstName,
      lastName: orders.customerLastName,
      phone: orders.customerPhone,
      birthDate: orders.customerBirthDate,
    })
    .from(orders)
    .where(sql`lower(${orders.customerEmail}) = ${user.email.trim().toLowerCase()}`)
    .orderBy(desc(orders.createdAt))
    .limit(1);

  const profile = profileOf(user);
  // Nombre y apellidos van juntos: no mezclar el nombre del perfil con el
  // apellido de un pedido.
  const hasProfileName = !!(profile.firstName || profile.lastName);
  return {
    email: user.email,
    firstName: hasProfileName ? profile.firstName : lastOrder?.firstName ?? '',
    lastName: hasProfileName ? profile.lastName : lastOrder?.lastName ?? '',
    phone: profile.phone || (lastOrder?.phone ?? ''),
    birthDate: profile.birthDate || (lastOrder?.birthDate ?? ''),
  };
}

export default async function CheckoutPage() {
  const [rates, physicalProducts, prefill, paymentMethods] = await Promise.all([
    db
      .select()
      .from(shippingRates)
      .where(eq(shippingRates.isActive, true))
      .orderBy(asc(shippingRates.sortOrder)),
    db
      .select({ slug: products.slug })
      .from(products)
      .where(and(eq(products.status, 'active'), eq(products.type, 'physical'))),
    prefillForSession(),
    getAvailablePaymentMethods(),
  ]);

  const dto: ShippingRateDTO[] = rates.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    freeOverAmount: r.freeOverAmount,
    countries: (r.countries as string[]) ?? [],
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-4">Checkout</h1>
      <div className="mb-8 rounded-xl border-2 border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))] p-4 sm:p-5">
        <p className="text-base font-semibold text-[hsl(var(--primary))]">
          📩 Recuerda revisar y estar al pendiente de tu correo electrónico
        </p>
        <p className="mt-1 text-sm leading-relaxed">
          Al terminar tu compra, ahí encontrarás la <strong>confirmación de tu
          pedido</strong> y tus <strong>reportes y/o accesos</strong>. Si no lo ves en
          unos minutos, busca en la carpeta de spam o &ldquo;Promociones&rdquo;.
        </p>
      </div>
      <CheckoutForm
        shippingRates={dto}
        physicalProductSlugs={physicalProducts.map((product) => product.slug)}
        currency={config.currency}
        paymentMethods={paymentMethods.map((m) => ({ method: m.method, label: m.label }))}
        simulate={config.simulatePayments}
        prefill={prefill}
      />
    </div>
  );
}
