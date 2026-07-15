import { z } from 'zod';

export const checkoutLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const shippingAddressSchema = z.object({
  name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().nullish(),
  city: z.string().min(1),
  state: z.string().nullish(),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  phone: z.string().nullish(),
});

export const reportPersonSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento inválida.'),
});

export const reportInputSchema = z.object({
  variantId: z.string().uuid(),
  person: reportPersonSchema,
  partner: reportPersonSchema.nullish(),
});

export const checkoutSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1, 'El nombre es obligatorio.'),
  lastName: z.string().trim().min(1, 'Los apellidos son obligatorios.'),
  phone: z.string().trim().min(6, 'El teléfono es obligatorio.'),
  // Fecha de nacimiento en formato YYYY-MM-DD (opcional).
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')
    .nullish()
    .or(z.literal('')),
  items: z.array(checkoutLineSchema).min(1),
  shippingRateId: z.string().uuid().nullish(),
  shippingAddress: shippingAddressSchema.nullish(),
  discountCode: z.string().trim().min(1).nullish(),
  // Datos por reporte (persona y, si aplica, pareja), indexados por variantId.
  reports: z.array(reportInputSchema).nullish(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

// ── Admin: alta de producto ─────────────────────────────────────

export const adminProductSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio.'),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido (usa minúsculas, números y guiones).'),
    description: z.string().trim().nullish(),
    type: z.enum(['digital', 'physical']),
    categoryId: z.string().uuid().nullish(),
    price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Precio inválido (ej. 9.99).'),
    currency: z.string().length(3).default('USD'),
    imageUrl: z.string().url().nullish().or(z.literal('')),
    status: z.enum(['draft', 'active', 'archived']).default('active'),
    // Digital
    fileUrl: z.string().url().nullish().or(z.literal('')),
    fileName: z.string().trim().nullish(),
    downloadLimit: z.number().int().positive().nullish(),
    // Físico
    stock: z.number().int().min(0).nullish(),
  })
  .refine(
    (d) => d.type !== 'digital' || (!!d.fileUrl && !!d.fileName),
    { message: 'Un producto digital requiere URL y nombre de archivo.', path: ['fileUrl'] },
  );

export type AdminProductInput = z.infer<typeof adminProductSchema>;

// ── Admin: alta de cupón ────────────────────────────────────────

export const adminCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guion y guion bajo.'),
  type: z.enum(['percent', 'fixed']),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido.'),
  minSubtotal: z.string().regex(/^\d+(\.\d{1,2})?$/).nullish().or(z.literal('')),
  maxRedemptions: z.number().int().positive().nullish(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal('')),
  isActive: z.boolean().default(true),
});

export type AdminCouponInput = z.infer<typeof adminCouponSchema>;
