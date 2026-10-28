import type { Metadata } from 'next';
import { NumerathumPlans } from '@/components/numerathum-plans';
import { listNumerathumPlans } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Planes Numerathum',
  description: 'Compara los planes Espejo, Horizonte 60 y Oráculo 365 con opciones de pago único mensual o anual.',
};

export default async function PlansPage() {
  const plans = await listNumerathumPlans();
  return <NumerathumPlans plans={plans} />;
}
