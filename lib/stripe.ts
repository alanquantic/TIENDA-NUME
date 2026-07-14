import Stripe from 'stripe';
import { stripeConfig } from './config';

let _stripe: Stripe | null = null;

/**
 * Cliente de Stripe perezoso: no se instancia en tiempo de import (evita
 * romper `next build` cuando no hay claves), solo al primer uso real.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!stripeConfig.secretKey) {
    throw new Error('Falta la variable de entorno STRIPE_SECRET_KEY');
  }
  _stripe = new Stripe(stripeConfig.secretKey, { typescript: true });
  return _stripe;
}
