# Tienda Nume

Tienda en línea (storefront + backend) para **productos digitales y físicos**,
construida con Next.js 14 full-stack, Drizzle (Neon/Postgres) y Stripe.

> Fase 1 (esto): productos digitales y físicos con carrito, checkout de invitado,
> pagos con Stripe, descargas digitales, stock, envío e impuesto fijo.
> Fase 2 (después): membresías (→ nume) y licencias (→ arithmax) sobre esta misma base.

---

## Stack

- **Next.js 14** (App Router, TypeScript) — storefront + API en un solo proyecto.
- **Drizzle ORM** + **Neon** (Postgres).
- **Stripe Checkout** (redirect) + webhooks.
- **Zustand** para el carrito (cliente, persistido en `localStorage`).
- Deploy pensado para **Vercel** + **Neon**.

## Qué incluye

| Área | Estado |
|---|---|
| Catálogo (categorías, digital/físico, variantes) | ✅ |
| Página de producto + carrito | ✅ |
| Checkout de **invitado** con correo | ✅ |
| Stripe Checkout (total exacto: subtotal, envío, impuesto, descuento) | ✅ |
| Webhook con **verificación de firma** + **idempotencia** | ✅ |
| Fulfillment transaccional: descuento de stock + descargas | ✅ |
| Entrega de productos **digitales** por enlace con token | ✅ |
| Envío por tarifa plana/zona + envío gratis por umbral | ✅ |
| Cupones de descuento (% o monto fijo) | ✅ |
| Impuesto fijo por configuración | ✅ |
| Checkout con datos del cliente (nombre, apellidos, tel., nacimiento, dirección) | ✅ |
| Panel admin: productos, **pedidos**, **cupones** | ✅ |
| Importar productos de WooCommerce (CSV) | ✅ |
| Cuentas de cliente (login/registro) | ⏳ esquema listo, UI pendiente |
| Pagos con Mercado Pago + PayPal | ⏳ siguiente paso (hoy el checkout usa Stripe) |
| Correo real (hoy es stub en consola) | ⏳ pendiente |

## Estructura

```
app/
  page.tsx                     Catálogo
  productos/[slug]/page.tsx    Detalle de producto
  carrito/page.tsx             Carrito
  checkout/page.tsx            Checkout (form)
  checkout/success|cancel/     Retorno de Stripe
  api/
    checkout/route.ts          Crea pedido + sesión de Stripe
    webhooks/stripe/route.ts   Recibe eventos de Stripe (idempotente)
    descargas/[token]/route.ts Descarga de productos digitales
components/                     UI (header, carrito, checkout, etc.)
lib/
  db/schema.ts                 Esquema Drizzle (11 tablas)
  db/seed.ts                   Datos de ejemplo
  pricing.ts                   Cálculo AUTORITATIVO de precios (server)
  fulfillment.ts               Post-pago: stock + descargas + cupón
  shipping.ts / money.ts       Utilidades
drizzle/                       Migraciones SQL generadas
```

## Puesta en marcha

1. **Dependencias** (ya instaladas):
   ```bash
   npm install
   ```

2. **Variables de entorno**: copia `.env.example` a `.env.local` y rellena:
   ```bash
   cp .env.example .env.local
   ```
   - `DATABASE_URL`: crea una base en [Neon](https://neon.tech) y usa la
     connection string **pooled** (con `-pooler` en el host).
   - `STRIPE_SECRET_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: de tu
     [dashboard de Stripe](https://dashboard.stripe.com/apikeys) (modo test).
   - `STRIPE_WEBHOOK_SECRET`: ver paso 5.

3. **Migraciones** (crea las tablas en Neon):
   ```bash
   npm run db:migrate      # aplica drizzle/*.sql
   # o, en desarrollo rápido:
   npm run db:push
   ```

4. **Datos de ejemplo**:
   ```bash
   npm run db:seed
   ```

5. **Webhook de Stripe** (en otra terminal, con el
   [CLI de Stripe](https://stripe.com/docs/stripe-cli)):
   ```bash
   stripe listen --forward-to localhost:3002/api/webhooks/stripe
   ```
   Copia el `whsec_...` que imprime a `STRIPE_WEBHOOK_SECRET` en `.env.local`.

6. **Arrancar**:
   ```bash
   npm run dev
   ```
   Abre <http://localhost:3002>. Usa la tarjeta de prueba `4242 4242 4242 4242`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 3002) |
| `npm run build` / `start` | Producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Genera SQL desde el esquema |
| `npm run db:migrate` / `db:push` | Aplica el esquema a la BD |
| `npm run db:seed` | Carga datos de ejemplo |
| `npm run db:import -- "ruta.csv"` | Importa productos de un export CSV de WooCommerce |
| `npm run db:studio` | Explorador de la BD (Drizzle Studio) |

## Importar de WooCommerce

```bash
npm run db:import -- "C:/ruta/al/export.csv"          # importa (idempotente por slug)
npm run db:import -- "C:/ruta/al/export.csv" --reset  # borra los previos de Woo y reimporta
```

Reglas del importador ([lib/db/import-wc.ts](lib/db/import-wc.ts)):
- Solo filas **publicadas** (`Publicado = 1`) y de tipo **`simple`**.
- Omite `variable`/`variation` (planes de pago/suscripción → se modelan en fase 2).
- Tipo `virtual` → **digital**; el resto → **físico**. Primera categoría e imagen.
- Los digitales se importan **sin archivo de descarga** (el CSV no trae URLs); se añaden en el admin.
- Marca los productos de **membresía** para revisarlos al integrar nume.

## Decisiones de diseño clave

- **El precio nunca se confía al cliente.** `lib/pricing.ts` recalcula todo
  desde la BD; el carrito del navegador solo guarda un snapshot para mostrar.
- **La sesión de Stripe cobra exactamente el total del pedido.** El descuento va
  como cupón `amount_off`, que reduce el total en el monto exacto sin importar
  la composición de líneas.
- **Idempotencia de webhooks** por `(provider, event_id)` único. Un evento se
  procesa una sola vez; si Stripe reintenta, se hace ack sin duplicar.
- **Fulfillment transaccional**: marcar pagado, descontar stock y crear las
  descargas ocurren en una sola transacción; re-ejecutar es no-op.
- **Pedidos inmutables**: `order_items` guarda snapshots (nombre, precio) para
  no depender de cambios futuros del catálogo.

## Siguiente fase (membresías + licencias)

Esta base es la tienda central. Para vender también membresías (nume) y
licencias (arithmax), se añadirá encima:
- Tipos de producto `membership` / `license` y enrutamiento por tipo tras el pago.
- Endpoints internos firmados (HMAC) hacia nume/arithmax para aprovisionar.
- Ciclo de vida de suscripción (renovación, mora, cancelación) vía webhooks.
- Flujo de canje para resolver identidad (checkout invitado → cuenta destino).
