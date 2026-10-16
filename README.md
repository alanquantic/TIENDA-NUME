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

## monday CRM: Agenda 2027 y Numerathum

Al confirmar el pago de `agenda-numerologica-2027`, se crea **un registro por
pedido** en el tablero `18434858318`, grupo PREVENTA (`new_group`). Configurar
`MONDAY_API_TOKEN` en `.env` y en el entorno del despliegue. Los otros valores
opcionales están documentados en `.env.example`.

- VENDEDOR: ALAN (índice `16`). Morada suma en OSCRURA (`numbers_2`) y amarilla
  en CLARA (`numbers_3`); CANTIDAD contiene la suma de ambas. ESTATUS se envía vacío.
- Incluye cliente, correo, teléfono, fecha de pago en Ciudad de México,
  dirección y número de pedido. Como CP es una columna de teléfono, se conserva
  junto a CALLE, incluyendo ceros iniciales. Si se cambia a Texto, la integración
  puede usar esa columna sin modificar el código. Calle/número y colonia/interior
  se conservan como los captura el checkout, sin inventar una separación.
- PAGO AGENDAS contiene el importe pagado por las agendas después de descuentos
  e impuestos. En pedidos mixtos se distribuye el neto de mercancías por importe
  de línea, en centavos. PAGO ENVIO contiene el envío completo del pedido.
- PayPal usa la opción PAYPAL de FORMA COMPRA. Mercado Pago queda sin etiqueta:
  no se asume que todo pago sea con tarjeta. ENTREGA, guía, recibo y comprobaciones
  de envío/empaque se dejan para la operación posterior.
- Los pagos simulados o sandbox se omiten por defecto. Para pruebas que deban
  crear registros en el tablero real, usar `MONDAY_SYNC_TEST_ORDERS=true`.

El producto Numerathum `44759e92-c983-41f8-8ff4-c9e972d3bebb` crea su propio
registro en el tablero `18379779965`, grupo `group_mkxprje7` («NUMERATHUM 2025»,
nombre actual del grupo proporcionado). También se envía cuando se compra solo.

- VENDEDOR es un dropdown distinto: ALAN usa `27`. PLAN usa ORACULO (`0`).
- Name recibe los nombres del comprador. Los apellidos del checkout se conservan
  juntos en Apellido Paterno, y Apellido Materno queda vacío hasta capturarlos por
  separado; no se intentan dividir automáticamente los apellidos compuestos.
- DD, MM y AÑO DE AA reciben la fecha de nacimiento del comprador, cuando se
  informa. MM usa las opciones de mes `1` a `12`, sin confundirlas con vendedor.
  FECHA DE COMPRA usa el día del pago en Ciudad de México.
- Correo, teléfono y `# PEDIDO WEB` (`__pedido_web`) corresponden al mismo pedido.
  Costo de COSTO y PAGO 1 contienen solo el importe pagado por Numerathum, sin
  otros productos ni envío. Se aplica el mismo reparto de descuentos/impuestos
  que en Agenda 2027. PAGO 2, RECIBOS y VERIFICAR no se rellenan automáticamente.
- PayPal usa FORMA DE PAGO `2`; los demás proveedores quedan sin etiqueta hasta
  definir el método exacto. Se conserva la política de pruebas de
  `MONDAY_SYNC_TEST_ORDERS` para ambos tableros.

Los trabajos se guardan en `orders.metadata.mondayAgenda2027` y
`orders.metadata.mondayNumerathum` dentro de la misma
transacción del pago, sin migraciones nuevas. El envío ocurre antes de generar
reportes/correos; si monday falla, la compra sigue completándose y el cron horario
existente (`/api/cron/reports`, protegido con `CRON_SECRET`) reintenta hasta ocho
intentos totales. Las compras anteriores a esta integración no se importan.

Los avisos simultáneos se coordinan con una reserva atómica; los reintentos buscan
primero `# PEDIDO WEB` y usan una clave estable de
[idempotencia de monday](https://developer.monday.com/api-reference/docs/idempotency).
El estado guarda intentos, error, próximo intento e ID del registro enviado.
Cada tablero conserva su propio estado e idempotencia: reintentar Numerathum no
reenvía Agenda 2027. Los trabajos anteriores de Agenda sin campo `kind` siguen
siendo compatibles. El aviso externo existente de Numerathum sigue funcionando.
Si se agotan los intentos, revisar ese estado y corregir la causa antes de reactivar
el trabajo. No se debe borrar `# PEDIDO WEB` en monday, pues identifica el registro.

Verificación local sin escrituras reales en monday: `npm run test:monday`.

## Siguiente fase (membresías + licencias)

Esta base es la tienda central. Para vender también membresías (nume) y
licencias (arithmax), se añadirá encima:
- Tipos de producto `membership` / `license` y enrutamiento por tipo tras el pago.
- Endpoints internos firmados (HMAC) hacia nume/arithmax para aprovisionar.
- Ciclo de vida de suscripción (renovación, mora, cancelación) vía webhooks.
- Flujo de canje para resolver identidad (checkout invitado → cuenta destino).
