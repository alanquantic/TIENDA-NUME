# Analytics — Tienda Nume

Instrumentación GA4 completa del funnel de ecommerce.

## Estado actual

- **Plataforma**: Google Analytics 4 únicamente.
- **Measurement ID**: `G-HE7B57PCBV` (env `NEXT_PUBLIC_GA4_MEASUREMENT_ID`).
- **Consent Mode**: v2 activo. Estados por defecto `denied`. Cookie: `tienda_consent` (180 días).
- **Cross-domain con WEB-NUME** (`numerologia-cotidiana.com`): en GA4 → Admin → Data Streams → Configure your domains → agrega ambos dominios para que la sesión se mantenga cuando el usuario cruza de un sitio al otro. WEB-NUME usa un measurement ID distinto (`G-42049MCJ59`); si quieres unificar reportes, considera crear una segunda propiedad o roll-up.

## Arquitectura de código

```
lib/analytics/
├── index.ts        # barrel: exports públicos
├── events.ts       # AnalyticsEventMap tipado (contrato único)
├── consent.ts      # Consent Mode v2 + cookie tienda_consent
├── gtag.ts         # wrapper de window.gtag: track(), pageView()
└── ecommerce.ts    # helpers: cartItemToGaItem, catalogCardToGaItem, itemsValue

components/analytics/
├── google-analytics.tsx    # <Script> gtag + consent defaults denied
├── route-tracker.tsx       # page_view manual App Router
├── consent-banner.tsx      # banner + update de consent
├── listing-tracker.tsx     # view_item_list en secciones del home
├── product-view-tracker.tsx  # view_item en ficha de producto
└── purchase-tracker.tsx    # purchase dedup por transaction_id
```

## Funnel de ecommerce instrumentado

| Etapa | Evento GA4 | Dónde |
|---|---|---|
| Ver listado | `view_item_list` | `<ListingTracker>` en `app/page.tsx` (uno por sección) |
| Click en tarjeta | `select_item` | `components/product-card.tsx` (onClick de los `<Link>`) |
| Añadir desde tarjeta | `add_to_cart` | `components/product-card.tsx` (botón "Agregar") |
| Ver ficha | `view_item` | `<ProductViewTracker>` en `app/productos/[slug]/page.tsx` |
| Añadir desde ficha | `add_to_cart` | `components/add-to-cart.tsx` |
| Ver carrito | `view_cart` | `components/cart-view.tsx` (una vez al mount) |
| Quitar del carrito | `remove_from_cart` | `components/cart-view.tsx` (botón "Quitar") |
| Empezar checkout | `begin_checkout` | `components/checkout-form.tsx` (mount con items) |
| Elegir envío | `add_shipping_info` | `components/checkout-form.tsx` (cambio de rate) |
| Pagar | `add_payment_info` | `components/checkout-form.tsx` (submit, antes de Stripe) |
| **Compra** | **`purchase`** | `<PurchaseTracker>` en `app/checkout/success/page.tsx` (dedup por `order.number`) |

Todos los eventos siguen el schema estándar GA4 Ecommerce con `items[]`, `currency`, `value`.

## Custom dimensions a registrar en GA4

**Admin → Custom definitions → Create custom dimension**:

| Param name | Display name | Scope |
|---|---|---|
| `item_list_id` | List ID | Event |
| `item_list_name` | List Name | Event |
| `item_category` | Item Category | Event |
| `coupon` | Coupon | Event |
| `shipping_tier` | Shipping Tier | Event |
| `payment_type` | Payment Type | Event |
| `transaction_id` | Transaction ID | Event |

## Conversiones

**Admin → Events → Marca como conversión**:
- `purchase` (conversión principal)
- `add_payment_info` (deep funnel, micro-conversión)
- `begin_checkout` (micro-conversión para optimizar campañas)

## Audiencias recomendadas

### 1. "Abandono de carrito"
- Include: `add_to_cart` en últimos 30 días.
- Exclude: `purchase` en últimos 30 días.
- Membership duration: 30 días.

### 2. "Abandono de checkout"
- Include: `begin_checkout` en últimos 14 días.
- Exclude: `purchase` en últimos 14 días.
- Duration: 14 días.

### 3. "Interés en categoría X"
- Include: `view_item_list` con `item_list_id = cat_agenda-numerologica` (o la que quieras).
- Duration: 60 días.
- Uso: campaña específica de esa categoría.

### 4. "Compradores últimos 90d" (para LAL en Ads)
- Include: `purchase` en últimos 90 días.
- Duration: 540 días.

### 5. "High-value buyers"
- Include: `purchase` con `value > 500` (ajusta al AOV).
- Duration: 540 días.

### 6. "Vio producto sin comprar"
- Include: `view_item`.
- Exclude: `purchase`.
- Duration: 30 días.

## Reportes clave

### Funnel de compra
GA4 → **Explore → Funnel exploration**:
1. `view_item`
2. `add_to_cart`
3. `begin_checkout`
4. `add_payment_info`
5. `purchase`

Divídelo por `item_category` para ver dónde se caen los usuarios por tipo de producto (digital vs físico).

### Productos más vistos vs más comprados
GA4 → **Reports → Monetization → Ecommerce purchases**. Compara `Items viewed` con `Items purchased`. Los productos con alto view/purchase ratio son candidatos a optimizar en ficha/precio.

### Descuentos que convierten
GA4 → **Explore → Free form**:
- Rows: `coupon`
- Values: purchase count, revenue.

## Cross-domain con WEB-NUME

WEB-NUME dispara `outbound_click` con `link_domain = tienda-nume-chi.vercel.app` cuando el usuario clickea a la tienda desde el sitio principal. Cuando la sesión cruza de dominio, GA4 la mantiene si:

1. Ambos dominios están en el mismo Data Stream (Admin → Data Streams → Configure your domains).
2. Los IDs de measurement no necesitan ser el mismo si tienes propiedades separadas, pero para atribución cross-site conviene una vista roll-up.

Como aquí la tienda usa `G-HE7B57PCBV` y WEB-NUME usa `G-42049MCJ59` (propiedades separadas), la vista cross-site se hace con Looker Studio o BigQuery (GA4 → Admin → BigQuery Links).

## Pruebas

1. `npm run dev` (puerto 3002) con `NEXT_PUBLIC_GA4_MEASUREMENT_ID` en `.env`.
2. Abre la tienda, acepta el banner de cookies.
3. GA4 → **Reports → Realtime**.
4. Navega: home → producto → añadir → carrito → checkout → simular compra.
5. Deberías ver la secuencia completa de eventos en Realtime.
6. Extensión **GA Debugger** de Chrome muestra los parámetros en consola.

## Pendientes

- Sumar Meta Pixel / TikTok Pixel (contrato ya tipado; agregar dispatchers en `gtag.ts`).
- CAPI (Conversions API) server-side para deduplicación con Ads y para eventos vía webhook de Stripe (`purchase` server-side desde el webhook evita perder eventos por ad-blockers).
- Refund tracking desde el flujo de reembolsos del admin.
