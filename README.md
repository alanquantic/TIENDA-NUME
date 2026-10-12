# Tienda Nume

Tienda en línea (storefront + backend) para **productos digitales y físicos**,
construida con Next.js 14 full-stack, Drizzle (Neon/Postgres), Mercado Pago y PayPal.

> Fase 1 (esto): productos digitales y físicos con carrito, checkout de invitado,
> pagos con Mercado Pago y PayPal, descargas digitales, stock, envío e impuesto fijo.
> Fase 2 (después): membresías (→ nume) y licencias (→ arithmax) sobre esta misma base.

---

## Stack

- **Next.js 14** (App Router, TypeScript) — storefront + API en un solo proyecto.
- **Drizzle ORM** + **Neon** (Postgres).
- **Mercado Pago Checkout Pro** y **PayPal Orders v2** (redirect) + webhooks, vía API REST.
- **Zustand** para el carrito (cliente, persistido en `localStorage`).
- Deploy pensado para **Vercel** + **Neon**.

## Qué incluye

| Área | Estado |
|---|---|
| Catálogo (categorías, digital/físico, variantes) | ✅ |
| Página de producto + carrito | ✅ |
| Checkout de **invitado** con correo | ✅ |
| Mercado Pago y PayPal (total exacto: subtotal, envío, impuesto, descuento) | ✅ |
| Webhooks: el pago se confirma consultando la API + firma opcional + bitácora | ✅ |
| Fulfillment transaccional: descuento de stock + descargas | ✅ |
| Entrega de productos **digitales** por enlace con token | ✅ |
| Envío por tarifa plana/zona + envío gratis por umbral | ✅ |
| Cupones de descuento (% o monto fijo) | ✅ |
| Impuesto fijo por configuración | ✅ |
| Checkout con datos del cliente (nombre, apellidos, tel., nacimiento, dirección) | ✅ |
| Panel admin: productos, **pedidos**, **cupones**, **envíos**, **pagos** | ✅ |
| Importar productos de WooCommerce (CSV) | ✅ |
| Cuentas de cliente (login/registro) | ⏳ esquema listo, UI pendiente |
| Correo real (hoy es stub en consola) | ⏳ pendiente |

## Estructura

```
app/
  page.tsx                     Catálogo
  productos/[slug]/page.tsx    Detalle de producto
  carrito/page.tsx             Carrito
  checkout/page.tsx            Checkout (form)
  checkout/success|cancel/     Retorno de la pasarela
  api/
    checkout/route.ts          Crea pedido + cobro en Mercado Pago o PayPal
    webhooks/mercadopago|paypal/ Avisos de pago de cada pasarela
    payments/paypal/return/    Captura el cobro al volver de PayPal
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
   - `MERCADOPAGO_*` y `PAYPAL_*`: llaves de cada pasarela por modo (prueba y
     producción). Luego se activan en **/admin/pagos**.
   - O `SIMULATE_PAYMENTS="true"` para probar el flujo sin pasarela.

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

5. **Avisos de pago en local**: Mercado Pago y PayPal no pueden llamar a
   `localhost`. En local el cobro de PayPal se confirma al volver a la tienda;
   para probar los webhooks usa un túnel (p. ej. ngrok) o el preview de Vercel.

6. **Arrancar**:
   ```bash
   npm run dev
   ```
   Abre <http://localhost:3002>. Para pagar en modo prueba usa los usuarios y
   tarjetas de prueba de Mercado Pago o una cuenta sandbox de PayPal.

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
- **La pasarela cobra exactamente el total del pedido.** Se envía una sola
  partida por el total (ya con descuento, envío e impuestos), y al confirmar el
  pago se verifica que monto y moneda cobrados coincidan con el pedido.
- **Nunca se confía en el aviso de la pasarela**: el estado del pago se consulta
  en su API. Los avisos quedan en `webhook_events`; el fulfillment es idempotente.
- **Las llaves de las pasarelas viven en variables de entorno**; la BD
  (`payment_settings`) solo guarda si cada método está activo y en qué modo.
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
