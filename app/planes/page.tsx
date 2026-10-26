import type { Metadata } from 'next';
import { NumerathumPlans } from '@/components/numerathum-plans';

export const metadata: Metadata = {
  title: 'Planes Numerathum',
  description: 'Compara los planes Espejo, Horizonte 60 y Oráculo 365 con opciones de pago único mensual o anual.',
};

export default function PlansPage() {
  return <NumerathumPlans />;
}
