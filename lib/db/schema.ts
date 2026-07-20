import {
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ───────────────────────────────────────────────────────────────
// Enums
// ───────────────────────────────────────────────────────────────

/** Tipo de producto: digital (descarga) o físico (requiere envío). */
export const productTypeEnum = pgEnum('product_type', ['digital', 'physical']);

export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'active',
  'archived',
]);

/**
 * Estado del pedido. Ciclo típico:
 * pending → paid → fulfilled  (y refunded / partially_refunded / cancelled)
 */
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
  'partially_refunded',
]);

export const paymentProviderEnum = pgEnum('payment_provider', [
  'stripe',
  'mercadopago',
  'paypal',
  'manual',
]);

export const discountTypeEnum = pgEnum('discount_type', ['percent', 'fixed']);

/**
 * Alcance del cupón:
 * - 'cart':    se aplica al total del carrito.
 * - 'product': solo descuenta las líneas de `productId`.
 */
export const discountScopeEnum = pgEnum('discount_scope', ['cart', 'product']);

export const webhookEventStatusEnum = pgEnum('webhook_event_status', [
  'pending',
  'processed',
  'failed',
  'ignored',
]);

// ───────────────────────────────────────────────────────────────
// Cuentas (opcionales). El checkout de invitado NO crea filas aquí;
// solo los clientes que deciden registrarse. Los pedidos referencian
// userId de forma opcional + customerEmail siempre.
// ───────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  isAdmin: boolean('is_admin').notNull().default(false),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ───────────────────────────────────────────────────────────────
// Catálogo
// ───────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    type: productTypeEnum('type').notNull(),
    status: productStatusEnum('status').notNull().default('draft'),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    // Impuesto por producto (porcentaje, ej. 16.00). Si es null se usa DEFAULT_TAX_RATE.
    taxRatePercent: decimal('tax_rate_percent', { precision: 5, scale: 2 }),
    // URLs de imágenes: string[]
    images: jsonb('images').notNull().default([]),
    // Peso en gramos para cálculo/estimación de envío (solo físicos).
    weightGrams: integer('weight_grams'),
    // Máximo de unidades por pedido (null = sin límite). 1 en membresías,
    // licencias, certificaciones, numerathum y kit primavera.
    maxPerOrder: integer('max_per_order'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    statusTypeIdx: index('idx_products_status_type').on(table.status, table.type),
  }),
);

/**
 * Toda compra es de una VARIANTE. Un producto simple tiene una variante
 * "Default". Un producto con opciones (talla/color) tiene varias.
 */
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Default'),
    sku: varchar('sku', { length: 80 }),
    priceAmount: decimal('price_amount', { precision: 10, scale: 2 }).notNull(),
    // Stock disponible. Ignorado para productos digitales (stock infinito).
    stock: integer('stock').notNull().default(0),
    // true = descuenta stock y bloquea sobreventa. Digital = false.
    trackInventory: boolean('track_inventory').notNull().default(true),
    // Atributos de la variante: { talla: 'M', color: 'rojo' }
    attributes: jsonb('attributes').notNull().default({}),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index('idx_variants_product').on(table.productId),
    skuIdx: uniqueIndex('ux_variants_sku').on(table.sku),
  }),
);

/**
 * Archivo descargable de un producto digital. Se entrega mediante
 * download_grants (tokens) tras el pago.
 */
export const digitalAssets = pgTable('digital_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type'),
  // Máximo de descargas por compra (null = ilimitado).
  downloadLimit: integer('download_limit'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ───────────────────────────────────────────────────────────────
// Envío (básico: tarifas planas, opcionalmente por zona)
// ───────────────────────────────────────────────────────────────

export const shippingRates = pgTable('shipping_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  // Códigos de país ISO-3166-1 alpha-2 cubiertos. [] = cualquier país.
  countries: jsonb('countries').notNull().default([]),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  // Envío gratis cuando el subtotal supera este monto (null = nunca).
  freeOverAmount: decimal('free_over_amount', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ───────────────────────────────────────────────────────────────
// Descuentos / cupones
// ───────────────────────────────────────────────────────────────

export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  type: discountTypeEnum('type').notNull(),
  // Para 'percent' es el porcentaje (10 = 10%); para 'fixed' es el monto.
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  // 'cart' = total del carrito; 'product' = solo las líneas de productId.
  scope: discountScopeEnum('scope').notNull().default('cart'),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  minSubtotal: decimal('min_subtotal', { precision: 10, scale: 2 }),
  maxRedemptions: integer('max_redemptions'),
  timesRedeemed: integer('times_redeemed').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ───────────────────────────────────────────────────────────────
// Pedidos
// ───────────────────────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Número legible para el cliente (ej. NUME-1042). Se asigna al crear.
    number: varchar('number', { length: 24 }).notNull().unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    customerEmail: text('customer_email').notNull(),
    // Datos del cliente capturados en el checkout.
    customerFirstName: text('customer_first_name'),
    customerLastName: text('customer_last_name'),
    customerPhone: text('customer_phone'),
    customerBirthDate: date('customer_birth_date'),
    status: orderStatusEnum('status').notNull().default('pending'),
    provider: paymentProviderEnum('provider').notNull().default('stripe'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    subtotalAmount: decimal('subtotal_amount', { precision: 10, scale: 2 }).notNull(),
    shippingAmount: decimal('shipping_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    discountCode: varchar('discount_code', { length: 40 }),
    // true si el pedido contiene al menos un producto físico.
    requiresShipping: boolean('requires_shipping').notNull().default(false),
    shippingMethod: text('shipping_method'),
    // { name, line1, line2, city, state, postalCode, country, phone }
    shippingAddress: jsonb('shipping_address'),
    // true si el cliente pidió factura (CFDI) en el checkout.
    requiresInvoice: boolean('requires_invoice').notNull().default(false),
    // Datos fiscales cuando requiresInvoice = true (CFDI 4.0):
    // { rfc, razonSocial, regimenFiscal, usoCfdi, postalCode, email }
    billingInfo: jsonb('billing_info'),
    // IDs de Stripe
    externalCheckoutId: text('external_checkout_id'),
    externalPaymentIntentId: text('external_payment_intent_id'),
    externalCustomerId: text('external_customer_id'),
    note: text('note'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (table) => ({
    userStatusIdx: index('idx_orders_user_status').on(table.userId, table.status),
    emailIdx: index('idx_orders_email').on(table.customerEmail),
    checkoutIdx: uniqueIndex('ux_orders_external_checkout').on(table.externalCheckoutId),
  }),
);

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  // Referencias "set null" para conservar el histórico si se borra el catálogo.
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: uuid('variant_id').references(() => productVariants.id, {
    onDelete: 'set null',
  }),
  // Snapshots (el pedido es inmutable aunque cambie el catálogo).
  name: text('name').notNull(),
  variantName: text('variant_name'),
  sku: varchar('sku', { length: 80 }),
  type: productTypeEnum('type').notNull(),
  unitAmount: decimal('unit_amount', { precision: 10, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Permiso de descarga generado tras el pago de un ítem digital.
 * El cliente descarga vía /api/descargas/[token].
 */
export const downloadGrants = pgTable(
  'download_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    digitalAssetId: uuid('digital_asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    downloadsUsed: integer('downloads_used').notNull().default(0),
    downloadLimit: integer('download_limit'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index('idx_download_grants_order').on(table.orderId),
  }),
);

// ───────────────────────────────────────────────────────────────
// Webhooks (idempotencia). Un evento se procesa una sola vez.
// ───────────────────────────────────────────────────────────────

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: paymentProviderEnum('provider').notNull().default('stripe'),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    status: webhookEventStatusEnum('status').notNull().default('pending'),
    payload: jsonb('payload').notNull(),
    relatedOrderId: uuid('related_order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    providerEventIdx: uniqueIndex('ux_webhook_events_provider_event').on(
      table.provider,
      table.eventId,
    ),
    statusIdx: index('idx_webhook_events_status').on(table.status),
  }),
);

// ───────────────────────────────────────────────────────────────
// Reportes generados (integración con el generador en Railway)
// ───────────────────────────────────────────────────────────────

export const generatedReports = pgTable(
  'generated_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // Ítem del pedido que produjo este reporte. Permite que un pedido tenga
    // dos productos que entreguen el MISMO reportKey con datos distintos
    // (regalo: Membresía para persona A + Kit para persona B, ambos con
    // "reporte-quien-soy").
    orderItemId: uuid('order_item_id').references(() => orderItems.id, {
      onDelete: 'cascade',
    }),
    reportKey: text('report_key').notNull(),
    productName: text('product_name'),
    status: text('status').notNull().default('pending'), // pending | ready | error | skipped
    url: text('url'),
    error: text('error'),
    // { person: { name, birthDate }, partner?: { name, birthDate } } — para reintentos
    input: jsonb('input').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // idempotencia: un reporte por (pedido, ítem, clave)
    orderItemReportIdx: uniqueIndex('ux_generated_reports_order_item_report').on(
      table.orderId,
      table.orderItemId,
      table.reportKey,
    ),
    statusIdx: index('idx_generated_reports_status').on(table.status),
  }),
);

// ───────────────────────────────────────────────────────────────
// Tipos inferidos
// ───────────────────────────────────────────────────────────────

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type ShippingRate = typeof shippingRates.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;
export type DigitalAsset = typeof digitalAssets.$inferSelect;
export type DownloadGrant = typeof downloadGrants.$inferSelect;
export type GeneratedReport = typeof generatedReports.$inferSelect;
