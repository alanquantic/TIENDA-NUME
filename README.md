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

## monday CRM: Agendas, Numerathum, Libro, ARITHMAX, cursos y reportes

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

Los productos activos de Planes Numerathum crean un registro por plan y pedido
en el tablero `18379779965`, grupo `group_mkxprje7` («NUMERATHUM 2025»):

| Plan | Producto | Opción PLAN |
| --- | --- | --- |
| Espejo | `872042a8-b6b6-472d-bca4-cdcd99d98a2c` | ESPEJO (`13`) |
| Horizonte 60 | `47f6d348-edc7-4971-8c6a-f2eb3ff3a640` | HORIZONTE (`4`) |
| Oráculo 365 | `bd660507-5d23-4451-a261-888bd8a5621e` | ORACULO (`0`) |

Las variantes mensual/anual del mismo producto comparten registro e importe.
Cada plan tiene su trabajo y reintentos independientes. `# PEDIDO WEB` contiene
`<número de pedido>:<slug del plan>` para distinguir planes de un mismo pedido.
El producto anterior `44759e92-c983-41f8-8ff4-c9e972d3bebb` deja de activar
nuevos envíos; sus trabajos pendientes conservan el formato e idempotencia anteriores.

Se conservan `MONDAY_NUMERATHUM_BOARD_ID` y `MONDAY_NUMERATHUM_GROUP_ID` como
destino compartido. Los productos se configuran con
`MONDAY_NUMERATHUM_ESPEJO_PRODUCT_ID`, `MONDAY_NUMERATHUM_HORIZONTE_PRODUCT_ID` y
`MONDAY_NUMERATHUM_ORACULO_PRODUCT_ID`; si no se definen, se usan los IDs de la tabla.
`MONDAY_NUMERATHUM_PRODUCT_ID` es la variable anterior y ya no se utiliza.

- VENDEDOR es un dropdown distinto: ALAN usa `27`. PLAN corresponde al producto comprado.
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

Las licencias Software ARITHMAX se envían al tablero `2823809976`, grupo
VERSION 3 (`group_mkxprje7`). Cada producto genera su propio registro por pedido:

| Licencia | Producto | Opción LICENCIA |
| --- | --- | --- |
| 1 año | `55ce45a6-3cdb-43c0-a2e2-23e9a67ec5b0` | 1 AÑO (`13`) |
| 3 años | `66b1fd58-0e42-4d23-a331-1f95fe8ba71a` | 3 AÑOS (`4`) |

Configurar `MONDAY_ARITHMAX_BOARD_ID`, `MONDAY_ARITHMAX_GROUP_ID`,
`MONDAY_ARITHMAX_1_YEAR_PRODUCT_ID`, `MONDAY_ARITHMAX_3_YEARS_PRODUCT_ID` y
`MONDAY_ARITHMAX_SELLER_ID` (ALAN, `27`, confirmado). Se reutiliza `MONDAY_API_TOKEN`.
Se envían comprador, correo, teléfono, nacimiento si existe, fecha de compra y el
importe pagado por esa licencia tras descuentos, sin otros productos ni envío.
PayPal usa `2` y Mercado Pago `16`. RECIBOS, PAGO 2 y VERIFICAR quedan sin capturar.
`# PEDIDO WEB` usa `<pedido>:arithmax-1-ano` o `<pedido>:arithmax-3-anos`;
los reintentos y claves de idempotencia son independientes por licencia.
Los pagos de prueba respetan `MONDAY_SYNC_TEST_ORDERS`.

Los cursos y certificaciones se envían al tablero `8931163014`, al grupo del producto:

| Producto | Grupo | Clave de configuración |
| --- | --- | --- |
| Certificación Completa Numerología | CERTIFICACIÓN COMPLETA | `COMPLETE` |
| Módulos 1 a 6 | MODULO 1 a MODULO 6, respectivamente | `MODULE_1` a `MODULE_6` |
| Diseño de Nombres con Numerología | TALLER DEL NOMBRE | `NAME_WORKSHOP` |
| Taller Numerología de las casas y los espacios | TALLER CASAS Y ESPACIOS | `SPACES_WORKSHOP` |
| Taller Numerología de Parejas | TALLER PAREJA PT 1 | `COUPLES_WORKSHOP` |

Configurar `MONDAY_COURSES_BOARD_ID` y, para cada clave de la tabla,
`MONDAY_COURSES_<CLAVE>_PRODUCT_ID` y `MONDAY_COURSES_<CLAVE>_GROUP_ID`.
Cada curso tiene su registro, referencia `<pedido>:<curso>`, importe neto y
reintentos independientes. Se envían los datos del comprador y su fecha de nacimiento
si existe. FORMA DE PAGO usa PAYPAL (`2`), MERCADO PAGO (`10`) o STRIPE (`108`).
Este tablero no tiene VENDEDOR. PAGO 2 se deja vacío.
`MONDAY_COURSES_STATUS_INDEX` configura ESTATUS: INSCRITO (`1`) para todos,
confirmado por el usuario. Vacío omite la columna.
El COMBO Niveles 1, 2, 3 y 4 no se envía, por indicación del usuario.

Los reportes numerológicos con grupo correspondiente se envían al tablero `8931198393`:

| Producto | Grupo | Clave de configuración |
| --- | --- | --- |
| ¿Quién soy? | QUIEN SOY | `WHO_AM_I` |
| Reporte: ¿Quién soy? | QUIEN SOY | `WHO_AM_I_LEGACY` |
| ¿Quién soy? Versión Extendida | QUIEN SOY VERSION EXTENDIDA | `WHO_AM_I_EXTENDED` |
| Nuestro Antídoto de Pareja | ANTIDOTO PAREJA | `COUPLE_ANTIDOTE` |
| Nuestra personalidad de pareja | PERSONALIDAD PAREJA | `COUPLE_PERSONALITY` |
| Año Personal de la Pareja 2026 | AÑO PERSONAL DE PAREJA | `COUPLE_YEAR` |
| Etapa de Vida 2026 | ETAPA DE VIDA | `LIFE_STAGE` |
| El Amor Según tu Año Personal | EL AMOR SEGUN AÑO PERSONAL | `LOVE_PERSONAL_YEAR` |
| ¿Quién es mi maestro? | QUIEN ES MI MAESTRO | `TEACHER` |
| La herida que sano con mi pareja | LA HERIDA DE PAREJA | `COUPLE_WOUND` |
| Numerología de Pareja | NUMEROLOGIA DE PAREJA | `COUPLE_NUMEROLOGY` |

Configurar `MONDAY_REPORTS_BOARD_ID` y, para cada clave,
`MONDAY_REPORTS_<CLAVE>_PRODUCT_ID` y `MONDAY_REPORTS_<CLAVE>_GROUP_ID`.
`MONDAY_REPORTS_STATUS_INDEX=1` establece INSCRITO. FORMA DE PAGO usa PAYPAL (`2`)
o STRIPE (`108`). Mercado Pago queda sin etiqueta, confirmado por el usuario:
`MONDAY_REPORTS_MERCADOPAGO_INDEX` permanece vacío porque aún no existe esa opción.
No se envían Mi energía vital y bienestar, Mi propósito y camino de vida,
Numerología en el amor, Numerología en el trabajo ni Reporte Semestral 2026,
por indicación del usuario al no tener grupos correspondientes.

Se usan el nombre y nacimiento de la persona y su pareja capturados en el reporte;
correo y teléfono corresponden al comprador. Si el pedido histórico no tiene datos
de reporte, se usan los del comprador. No se dividen nombres completos en apellidos.
Si un mismo producto tiene destinatarios distintos en varias líneas, el envío queda
pendiente con `multiple-report-recipients-needs-review` para evitar mezclar datos.
Los importes netos, referencias `<pedido>:<reporte>` y reintentos son independientes
por producto; no se crean reportes de productos de otras categorías, como regalos
incluidos en membresías o kits. PAGO 2 queda vacío.

El libro `753b6bc0-2e2f-4f9a-a248-4e248dc6fe4f` crea un registro por pedido
en el tablero `18314877163`, grupo PREVENTA (`new_group`). Opciones de entorno:
`MONDAY_LIBRO_BOARD_ID`, `MONDAY_LIBRO_GROUP_ID` y `MONDAY_LIBRO_PRODUCT_ID`.

- VENDEDOR: ALAN (`16`), ESTATUS vacío. Cliente, correo, teléfono, fecha de compra,
  dirección y `# PEDIDO WEB` (`texto`) provienen del pedido pagado.
- CANTIDAD suma solo los libros; PAGO LIBROS contiene solo su importe neto,
  incluyendo el reparto de descuentos/impuestos. PAGO ENVIO refleja el cargo
  completo del pedido, igual que en Agenda: si ambos están en el carrito, ese
  cargo aparece como referencia en ambos tableros y no debe sumarse entre ellos.
- CP se conserva junto a CALLE mientras su columna sea Teléfono; si pasa a Texto,
  se usa esa columna. No se inventa una separación de número/interior.
- FORMA COMPRA: PAYPAL (`7`) o MERCADO PAGO (`8`). ENTREGA, guía, recibo y
  comprobaciones de envío/empaque se dejan para operación. Se respeta
  `MONDAY_SYNC_TEST_ORDERS`, también cuando el libro se compra solo.

Los trabajos se guardan en `orders.metadata.mondayAgenda2027`,
`orders.metadata.mondayNumerathum` y `orders.metadata.mondayLibro` dentro de la misma
transacción del pago, sin migraciones nuevas. El envío ocurre antes de generar
reportes/correos; si monday falla, la compra sigue completándose y el cron horario
existente (`/api/cron/reports`, protegido con `CRON_SECRET`) reintenta hasta ocho
intentos totales. Las compras anteriores a esta integración no se importan.

Los avisos simultáneos se coordinan con una reserva atómica; los reintentos buscan
primero `# PEDIDO WEB` y usan una clave estable de
[idempotencia de monday](https://developer.monday.com/api-reference/docs/idempotency).
El estado guarda intentos, error, próximo intento e ID del registro enviado.
Cada tablero conserva su propio estado e idempotencia: reintentar un producto no
reenvía los otros. Los trabajos anteriores de Agenda sin campo `kind` siguen
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
