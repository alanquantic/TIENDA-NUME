# Reporte de seguridad: acceso, registro y checkout

Fecha: 2026-10-12 (actualizado con los cambios implementados) · Rama: `claude/checkout-security-audit-4292b2` (base `main` @ 716a6a1)
Alcance: middleware, login/logout de cliente y admin, `/checkout`, `/api/checkout`,
`/checkout/success`, retorno de PayPal, webhooks (Mercado Pago, PayPal, generador),
`/api/descargas/[token]`, cron, `/api/cart/validate` y la analítica que corre en esas páginas.
Fuera de alcance: la API de nume (registro, contraseñas, emisión de JWT), que vive en otro repo.

Método: revisión estática del código. No se hicieron pruebas contra producción.

---

## 1. Resumen

El cobro está bien resuelto: el precio se recalcula en el servidor, el monto y la
moneda cobrados se comparan con el pedido antes de entregar, los webhooks consultan
la pasarela en vez de creer el aviso y la tienda no guarda contraseñas ni datos de tarjeta.

El punto débil es **qué protege los datos después del pago**. El único control de
`/checkout/success` es el `id` del pedido en la URL: quien tenga esa URL ve el correo
del cliente, lo que compró, y puede descargar sus archivos y reportes (con nombre y
fecha de nacimiento de las personas), sin límite de tiempo. Esa URL además se manda
a Google Analytics.

| # | Hallazgo | Severidad | Estado |
|---|----------|-----------|--------|
| H1 | `/checkout/success?order=<uuid>` muestra datos y descargas sin autenticación ni caducidad | **Alta** | ✅ Corregido |
| H2 | La URL con el `id` del pedido se envía a Google Analytics (`page_location`) | **Alta** | ✅ Corregido |
| H3 | `/cuenta` y el prefill confían en que nume verificó el correo del usuario | **Alta** | ✅ Corregido (tienda + API-NUME#22) |
| H4 | `/api/checkout` sin límite de peticiones: pedidos basura y correos a terceros | Media | 🟡 Parcial |
| H5 | Webhooks aceptan avisos sin firma si falta el secreto; `mode` lo elige quien llama | Media | ✅ Corregido |
| H6 | `CRON_SECRET` opcional: sin él, el cron es público | Media | ✅ Código · ⚠️ falta variable |
| H7 | `SIMULATE_PAYMENTS` no está bloqueado en producción | Media | ✅ Corregido |
| H8 | Descargas: redirige a la URL real del archivo; límite no atómico; sin caducidad | Media | 🟡 Parcial |
| H9 | Login sin rate limit propio; la API de nume ve todo desde la IP de Vercel | Media | ⏳ Pendiente |
| H10 | Login/logout aceptan peticiones de otros sitios (CSRF de login) | Baja | ✅ Corregido |
| H11 | `resolveBaseUrl` usa `Origin`/`Host` si `NEXT_PUBLIC_APP_URL` falta o es localhost | Baja | ✅ Variable presente en Vercel |
| H12 | Sin cabeceras de seguridad (CSP, frame-ancestors, etc.) | Baja | 🟡 Parcial |
| H13 | `images.remotePatterns: '**'` convierte `/_next/image` en proxy abierto | Baja | ⏳ Pendiente |
| H14 | Secretos y variables en Vercel (ver §4) | **Alta** | ⚠️ Acción manual |

---

## 2. Qué información viaja en cada llamada

### 2.1 Navegador → tienda

| Llamada | Envía el navegador | Responde la tienda | Observaciones |
|---|---|---|---|
| `POST /api/cuenta/login` | correo + contraseña (JSON) | `{ ok, email }` + cookies `nume_at`/`nume_rt` (httpOnly, `SameSite=Lax`, `Secure` en prod) | Los JWT no llegan a JS. Correcto. |
| `POST /api/cuenta/logout` | cookies | borra cookies | No exige método distinto a POST ni origen. |
| `GET /checkout` | cookies (opcional) | HTML con **prefill**: correo de la sesión + nombre, apellidos, teléfono y fecha de nacimiento del último pedido con ese correo | Ver H3. |
| `POST /api/cart/validate` | `variantId`, `slug` | estado de cada línea | Público, solo catálogo. OK. |
| `POST /api/checkout` | correo, nombre, apellidos, teléfono, fecha de nacimiento, dirección, **RFC/razón social/régimen/CP fiscal**, datos de reportes (**nombre y fecha de nacimiento de terceros**: pareja, regalo), cupón | `{ url, orderId }` (en error de validación: `details` de zod) | No requiere sesión: el correo es libre. `orderId` = llave de acceso a H1. |
| `GET /checkout/success?order=` | `id` del pedido | correo, número de pedido, productos, montos, cupón, **tokens de descarga**, **URLs de PDF y vista web de reportes** | Sin autenticación (H1). |
| `GET /api/descargas/[token]` | token | `302` a la URL **real** del archivo | H8. |
| `GET /api/payments/paypal/return` | `order`, `token` | redirección | Valida que `token` sea la orden de PayPal del pedido. Correcto. |

Persistencia en el navegador: el carrito (zustand → `localStorage`) solo guarda
productos. La deduplicación de `purchase` guarda el número de pedido. No se guardan
datos personales.

### 2.2 Tienda → terceros

| Destino | Datos enviados | Comentario |
|---|---|---|
| API de nume `/auth/*` | correo + contraseña (login), access/refresh token | HTTPS. No se reenvía la IP del cliente (H9). |
| Mercado Pago (preferencia) | correo, nombre, apellidos, total, `external_reference = order.id` | Mínimo necesario. |
| PayPal (orden) | total, descripción, `custom_id = order.id` | Mínimo necesario. |
| Generador de reportes | nombre y fecha de nacimiento (persona/pareja), `orderId` | Firmado con HMAC. Los PDF resultantes quedan en URLs públicas del generador. |
| Webhooks externos (membresía, licencia…) | correo, nombre, **teléfono, fecha de nacimiento**, pedido | Firma HMAC solo si existe `STORE_WEBHOOK_SECRET`; sin él va sin firmar. |
| Google Analytics | `page_location` completo (incluye `?order=<uuid>`), productos, total, cupón, número de pedido | H2. Solo si el usuario aceptó cookies de analítica. |
| Meta Pixel | URL de la página, productos, total, número de pedido (`eventID` de `Purchase`) | Solo si el usuario aceptó el banner; nunca desde `/admin`. |
| Resend (correo) | correo y contenido del pedido, enlaces de descarga | Esperado. |

---

## 3. Hallazgos

### H1 · Página de éxito accesible solo con el id del pedido — Alta
`app/checkout/success/page.tsx:35-65` busca el pedido por `searchParams.order` y
muestra correo, productos, totales, enlaces `/api/descargas/<token>` y URLs de PDF
de reportes. No verifica sesión, cookie ni caducidad.

El `id` es UUID v4 (`gen_random_uuid()`), así que no se puede adivinar. El riesgo
está en que **la URL es la contraseña** y circula por muchos lados: historial del
navegador, capturas que el cliente comparte con soporte, GA (H2), logs de Vercel,
y la `success_url`/`return_url` que guardan Mercado Pago y PayPal. Quien la obtenga:

- ve el correo y lo que compró la persona;
- consume sus descargas (cada clic gasta del `downloadLimit` del dueño);
- descarga reportes que contienen nombre y fecha de nacimiento, también de terceros (pareja, regalos).

La misma URL sirve para siempre.

### H2 · El id del pedido se manda a Google Analytics — Alta
`components/analytics/route-tracker.tsx:14-16` arma `pathname?query` y
`lib/analytics/gtag.ts:38` envía `page_location: window.location.href`. En
`/checkout/success?order=…` eso entrega la llave de H1 a Google y a cualquiera con
acceso a la propiedad de GA.

### H3 · `/cuenta` y el prefill dependen de que nume verifique el correo — Alta (condicional)
`app/cuenta/page.tsx:69` lista **todos** los pedidos cuyo `customer_email` coincide
con el correo de la sesión, con sus descargas y reportes; `app/checkout/page.tsx:27-45`
precarga nombre, teléfono y fecha de nacimiento del último pedido con ese correo.

El registro está en la API de nume (`/registro`). Si nume deja crear una cuenta con
un correo **sin confirmar que es de quien se registra**, cualquiera puede registrarse
con el correo de un cliente de la tienda y ver todo su historial. **Hay que confirmar
en el repo de nume que la verificación de correo es obligatoria antes de emitir
tokens**, o que `/auth/me` expone `email_verified` para que la tienda lo exija.

Efecto secundario: como el checkout es de invitado y el correo es libre, alguien puede
crear pedidos con el correo de otra persona y meter su nombre o teléfono en el
prefill de esa persona.

**Verificado el 2026-10-12 en `API NUME` (`origin/master`, `src/modules/auth/auth.service.ts` → `register`):**
el registro crea el usuario y **devuelve tokens de sesión de inmediato**, sin enviar ni exigir confirmación
de correo. La tabla `users` no tiene columna de verificación. Las únicas cuentas creadas por otra vía son
las de compras de membresía (`store-webhook`, con contraseña enviada por correo).

Consecuencia: cualquier cliente de la tienda **sin cuenta en nume** (por ejemplo, quien solo compró
reportes) está expuesto. Un tercero puede registrarse con su correo en `/registro`, entrar a `/cuenta` de
la tienda y ver sus pedidos, descargas y reportes (nombre y fecha de nacimiento, también de terceros), y
recibir en el checkout el prefill con su teléfono y fecha de nacimiento. Los correos que ya tienen cuenta
(los 804 usuarios importados de WordPress y los creados por membresía) están protegidos, porque el registro
responde 409.

Corrección propuesta:
1. **nume:** agregar `email_verified_at` a `users`; `register` manda un enlace de confirmación y
   `/auth/me` expone `email_verified`. Marcar como verificados los usuarios importados y los creados por
   `store-webhook` (su contraseña llegó a ese correo). Opcional: no emitir tokens hasta confirmar.
2. **tienda:** `/cuenta` y el prefill del checkout solo muestran datos si `email_verified === true`; si no,
   piden confirmar el correo.

**Corrección aplicada:**
- API: alanquantic/API-NUME#22. `/auth/me` devuelve `email_verified`, y hay endpoints `verify-email` y `resend-verification`.
- Tienda:
  - `/cuenta` no consulta pedidos si `email_verified !== true`; muestra "Confirma tu correo" con un botón de reenvío (`POST /api/cuenta/reenviar-verificacion`).
  - El prefill del checkout solo trae el correo de la sesión.
- **Orden de despliegue:** primero la API. Una API sin el campo hace que la tienda trate a todos como no verificados.

### H4 · `/api/checkout` sin límite de peticiones — Media
Cada `POST` crea un pedido `pending`, sus ítems y una preferencia en Mercado Pago o
PayPal. No hay rate limit, captcha ni sesión. Consecuencias:

- Llenar la base de pedidos basura y gastar llamadas a las pasarelas.
- **Correos a terceros**: una hora después, `expireAbandonedOrders` (`lib/payments/expire.ts`)
  cancela los pedidos y llama a `notifyOrderFailed`, que escribe al `customerEmail`.
  Un atacante puede hacer que la tienda mande correos de "pedido cancelado" a
  cualquier dirección, lo que daña la reputación del dominio remitente en Resend.
- Con `BATCH` limitado, una avalancha de pedidos basura retrasa la revisión de los reales.

### H5 · Webhooks: firma opcional y `mode` elegido por quien llama — Media
- `verifyMpSignature` (`lib/payments/mercadopago.ts:138`) y `verifyPpWebhook`
  (`lib/payments/paypal.ts:182`) devuelven `null` si falta el secreto, y la ruta
  solo rechaza `=== false`: **sin secreto se acepta cualquier aviso**. El daño está
  acotado porque después se consulta la pasarela y se compara el monto, pero el
  endpoint queda abierto para escribir en `webhook_events` y disparar capturas de PayPal.
- `?mode=sandbox|production` viene en la URL. `completeOrderPayment` no comprueba que
  el modo del pago coincida con `order.metadata.paymentMode`. Hoy un pago sandbox no
  puede apuntar a un pedido de producción sin las credenciales sandbox de la tienda,
  pero conviene cerrarlo.

### H6 · Cron público si falta `CRON_SECRET` — Media
`app/api/cron/reports/route.ts:63-66`: `if (secret && …)`. Sin la variable, cualquiera
puede disparar cancelaciones, correos y llamadas al generador. La comparación tampoco
es de tiempo constante.

### H7 · `SIMULATE_PAYMENTS` sin bloqueo en producción — Media
`app/api/checkout/route.ts:216-234`: con la variable activa, el pedido se marca pagado
y se entrega sin cobro, y el error devuelve `detail` interno. Basta con un error de
configuración en Vercel para regalar la tienda.

### H8 · Descargas — Media
`app/api/descargas/[token]/route.ts`:
- Redirige (`302`) a `digitalAssets.fileUrl`, la URL permanente del archivo. Después
  del primer clic, la URL real se puede compartir sin pasar por el límite.
- La comprobación del límite y el incremento son dos consultas: con peticiones
  simultáneas se supera `downloadLimit`.
- `lib/fulfillment.ts:232-240` no fija `expiresAt`; los tokens no caducan.

### H9 · Login sin rate limit propio — Media
`/api/cuenta/login` y `/api/admin/login` delegan todo a nume. nume ve **todas** las
peticiones desde las IPs de Vercel (no se reenvía `X-Forwarded-For`), así que:
o el límite de nume es por IP y un atacante bloquea el login de todos los clientes,
o es por cuenta y no frena el password spraying. El panel admin usa el mismo flujo.

### H10 · CSRF de login/logout — Baja
`req.json()` parsea el cuerpo sin mirar `Content-Type`, y no se valida `Origin`.
Un sitio externo puede enviar un formulario `text/plain` que inicie sesión a la víctima
en una cuenta del atacante (lo que ve y compra queda a nombre del atacante) o la
desconecte.

### H11 · URL base tomada de cabeceras — Baja
`resolveBaseUrl` (`app/api/checkout/route.ts:65-78`) cae a `Origin`/`Host` si
`NEXT_PUBLIC_APP_URL` falta o apunta a localhost. Solo afecta los pedidos de quien
manda la cabecera, pero hace que `notification_url` y las URLs de retorno dependan
de datos del cliente.

### H12 · Sin cabeceras de seguridad — Baja
`next.config.mjs` no define `headers()`. Falta `Content-Security-Policy`
(incluido `frame-ancestors`, contra clickjacking en checkout y login),
`Referrer-Policy`, `X-Content-Type-Options` y `Permissions-Policy`.

### H13 · Optimizador de imágenes abierto — Baja
`images.remotePatterns: [{ hostname: '**' }]` deja que cualquiera use
`/_next/image?url=` como proxy de cualquier host. Cuesta cómputo de Vercel.

### Lo que está bien
- Precio y envío recalculados en el servidor (`priceCart`); el cliente no fija montos.
- `completeOrderPayment` compara monto y moneda antes de entregar; fulfillment idempotente.
- Webhooks consultan la pasarela; deduplicación por `(provider, eventId)`.
- Retorno de PayPal amarrado a `externalCheckoutId`.
- `/api/reports/ready` con HMAC y `timingSafeEqual`.
- JWT en cookies httpOnly; el admin exige `role === 'admin'` en la API y niega si nume no responde.
- Tokens de descarga con 192 bits de entropía; ids de pedido UUID v4.
- Zod en todas las entradas del checkout.

---

## 4. Variables de entorno en Vercel (proyecto `tienda-nume`)

Se revisaron los **nombres** de las variables, sin descifrar valores.

| Hallazgo | Riesgo | Acción |
|---|---|---|
| El **valor** de `REPORT_READY_WEBHOOK_SECRET` está escrito en el campo *Comentario* de la variable, que se ve en texto plano | Cualquiera con acceso al proyecto, o una captura del panel, lo obtiene y puede marcar reportes como listos con una URL de PDF arbitraria | **Rotar** el secreto (también en el generador) y **borrar el comentario** |
| No existe `CRON_SECRET` | Hoy el cron es público. Con este cambio se rechaza en producción: **hay que crearla antes del deploy** o se detienen las cancelaciones y los reintentos de reportes | Crear `CRON_SECRET` (32+ caracteres aleatorios) en Production |
| No existen `MERCADOPAGO_WEBHOOK_SECRET(_TEST)` ni `PAYPAL_WEBHOOK_ID(_SANDBOX)` | Con este cambio, en producción se rechazan los webhooks sin firma. PayPal sigue confirmando por la ruta de retorno y el cron concilia cada hora | Crear los webhooks en los paneles de MP/PayPal y cargar sus secretos |
| `SIMULATE_PAYMENTS` existe en Production y Preview | Si vale `true`, hoy producción entrega sin cobrar. Con este cambio se ignora en Production; si no hay un método de pago activo en `/admin/pagos`, el checkout mostrará "Elige un método de pago disponible" | Borrarla de Production; activar PayPal/MP en `/admin/pagos` |
| `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `ADMIN_EMAIL` | Ya no se usan en el código (el admin entra con nume): son secretos huérfanos | Borrarlas |
| `DOWNLOAD_TOKEN_SECRET` | Ahora firma la cookie de acceso al pedido. Si falta en producción, el checkout falla en lugar de usar `dev-secret` | Confirmar que tiene un valor largo y aleatorio |
| En Production solo hay llaves PayPal **sandbox** | Todo cobro en producción es de prueba | Cargar `PAYPAL_CLIENT_ID`/`SECRET` o `MERCADOPAGO_ACCESS_TOKEN` antes de vender |

---

## 5. Lo que se ve desde el navegador (consola, red, código de página)

Requisito: ningún dato sensible se debe poder ver u obtener inspeccionando el navegador.

| Superficie | Antes | Ahora |
|---|---|---|
| Respuesta de `POST /api/checkout` (pestaña Red) | `{ url, orderId }` | `{ url }`. El `orderId` ya no sale al navegador |
| URL de éxito/cancelación (barra, historial, `location.href`) | `?order=<uuid>` + parámetros de MP/PayPal (`payment_id`, `external_reference`, `token`, `PayerID`) | El middleware redirige a la URL sin query string; ningún id queda en el historial |
| HTML/RSC de `/checkout/success` (`self.__next_f` en consola) | Correo, productos, tokens de descarga y URLs de reportes de cualquier pedido cuyo id se conociera | Solo con la cookie `nume_order` (httpOnly, firmada con HMAC, 24 h), que JavaScript no puede leer |
| `window.dataLayer` (consola) | `page_location` con `?order=` | Solo la ruta y los parámetros de campaña (`utm_*`, `gclid`, `fbclid`, …) |
| Cookies (`document.cookie`) | `nume_at`/`nume_rt` httpOnly | Igual; `nume_order` también es httpOnly |
| Variables `NEXT_PUBLIC_*` (van dentro del JS) | Solo URLs públicas e id de GA | Sin cambios; no hay secretos expuestos |
| Llaves de pasarelas en `/admin/pagos` | Viven solo en variables de entorno; la UI solo ve "configurado sí/no" | Sin cambios |
| `console.log` en componentes cliente | No hay | Sin cambios |

Lo que **sí** sigue llegando al navegador, a propósito:
- El prefill del checkout (correo, nombre, teléfono, fecha de nacimiento), **solo para el usuario con sesión** y solo con sus propios datos. Depende de H3.
- `/cuenta` con los pedidos del correo de la sesión, sus descargas y sus reportes. También depende de H3.
- Los errores de validación de zod, que solo dicen qué campo falló, sin datos de otros usuarios.

---

## 6. Cambios implementados (rama `claude/checkout-security-audit-4292b2`)

| Archivo | Cambio |
|---|---|
| `lib/order-access.ts` (nuevo) | Cookie `nume_order` = `orderId.expira.HMAC` (firmada con `DOWNLOAD_TOKEN_SECRET`, 24 h, httpOnly, `SameSite=Lax`) |
| `app/api/checkout/route.ts` | Fija la cookie; URLs de éxito/cancelación sin id; la respuesta ya no incluye `orderId`; máximo 5 pedidos pendientes por correo por hora |
| `app/checkout/success/page.tsx` | El pedido sale solo de la cookie; sin ella se muestra un mensaje genérico con enlace a `/cuenta` |
| `middleware.ts` | `/checkout/success` y `/checkout/cancel` se redirigen sin query string |
| `app/api/payments/paypal/return/route.ts` | Redirige a éxito/cancelación sin id |
| `lib/analytics/gtag.ts`, `components/analytics/google-analytics.tsx` | GA solo recibe los parámetros de campaña de la URL |
| `lib/config.ts` | `SIMULATE_PAYMENTS` se ignora con `VERCEL_ENV=production` |
| `lib/payments/complete.ts` + webhooks | El modo del aviso debe coincidir con el del pedido; en producción se rechaza lo que llegue sin secreto o sin firma |
| `app/api/cron/reports/route.ts` | En cualquier deploy de Vercel (producción y preview, que comparten base) se rechaza si no hay `CRON_SECRET`; comparación en tiempo constante |
| `app/api/descargas/[token]/route.ts` | Consumo de descarga atómico (`UPDATE … WHERE downloads_used < download_limit`) |
| `lib/request-guard.ts` (nuevo) + login/logout/checkout | Rechaza un `Origin` ajeno (403) y los cuerpos que no son JSON (415) |
| `next.config.mjs` | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; quita `X-Powered-By` |

Verificado en local (`next dev`, sin escribir en la base):
- `tsc` sin errores.
- La URL de éxito con query se redirige sin query (307).
- La página de éxito sin cookie, o con una cookie falsificada, muestra el mensaje genérico.
- Login, logout y checkout desde otro origen devuelven 403; el login con `text/plain` devuelve 415.
- Las cabeceras están presentes.
- La firma de la cookie rechaza otro pedido, una expiración alterada y una cookie vencida.
- El sanitizador de GA solo deja `utm_*`/`gclid`.

No se probó de punta a punta una compra real con MP/PayPal, porque requiere sandbox y escribe en la base.

**Efecto en clientes:** quien termine el pago en otro navegador o dispositivo (por ejemplo, cuando la app
de Mercado Pago abre otro navegador) verá "revisa tu correo / tu cuenta" en lugar del detalle. El correo
de confirmación sigue llevando los enlaces.

---

## 7. Plan de seguridad (pendientes)

### Fase 1 — inmediata (1–2 días)
1. ✅ **Sacar el id de pedido de GA** (H2): en `route-tracker.tsx`/`gtag.ts`, quitar el
   query string de `page_location`/`page_path` (o al menos `order`) antes de enviar.
2. ✅ **Variables obligatorias en producción** (H5, H6, H7). Faltan cargar las variables, ver §4: al arrancar, si
   `VERCEL_ENV === 'production'` y falta `CRON_SECRET`, `MERCADOPAGO_WEBHOOK_SECRET`,
   `PAYPAL_WEBHOOK_ID`, `REPORT_READY_WEBHOOK_SECRET` o `STORE_WEBHOOK_SECRET`, fallar;
   y si `SIMULATE_PAYMENTS` está activo, negarse a cobrar. En las rutas, tratar
   `null` (secreto ausente) como rechazo.
3. ❌ **Verificación de correo en nume** (H3): confirmado que NO existe. Ver la corrección propuesta en H3.
4. Revisar en Vercel que `NEXT_PUBLIC_APP_URL` apunte al dominio real (H11).

### Fase 2 — corto plazo (1–2 semanas)
5. ✅ **Proteger la página de éxito** (H1). Se implementó con cookie firmada en lugar de token en la URL:
   - Al crear el pedido, generar un `accessToken` aleatorio (32 bytes) y guardar su
     hash en `orders`; ponerlo en una cookie httpOnly de corta vida ligada al pedido y
     en la `success_url` (`?order=…&k=…`).
   - `/checkout/success` muestra detalle y descargas solo si la cookie o `k` son
     válidos y el pedido tiene menos de N horas (p. ej. 24 h). Fuera de eso, mostrar
     solo "Revisa tu correo" o pedir iniciar sesión en `/cuenta`.
   - Ocultar parcialmente el correo (`an***@dominio.com`).
6. 🟡 **Rate limit** (hecho: 5 pedidos pendientes por correo por hora; falta el límite por IP) en `/api/checkout`, `/api/cuenta/login` y `/api/admin/login` (H4, H9):
   Vercel Firewall (reglas por IP) o Upstash Ratelimit. Sugerido: checkout 10/h por
   IP y 3 pedidos pendientes por correo; login 5/min por IP y 10/h por correo.
7. **Reenviar la IP real a nume** (`X-Forwarded-For`) y acordar con nume que su
   límite use esa cabecera solo cuando venga de la tienda (cabecera firmada o IP
   de confianza).
8. **No avisar cancelaciones a pedidos sin interacción con la pasarela** (H4): solo
   mandar `notifyOrderFailed` si el pedido tiene `externalCheckoutId` y la pasarela
   registra un intento de pago.
9. 🟡 **Descargas** (H8). Hecho: incremento atómico; faltan la URL firmada y la caducidad: servir el archivo con una URL firmada de vida corta (Cloudinary
   ya está integrado: `lib/cloudinary.ts`), fijar `expiresAt` (p. ej. 30 días) y hacer
   el incremento atómico:
   `UPDATE … SET downloads_used = downloads_used + 1 WHERE id = $1 AND (download_limit IS NULL OR downloads_used < download_limit) RETURNING …`.
10. ✅ **Webhooks** (H5): ignorar `?mode` y tomar el modo del pedido
    (`order.metadata.paymentMode`); rechazar si no coinciden.

### Fase 3 — endurecimiento (1 mes)
11. 🟡 **Cabeceras** (H12). Hecho todo menos la CSP completa de scripts en `next.config.mjs`: CSP con `frame-ancestors 'none'` y
    orígenes de GA, Mercado Pago y PayPal; `Referrer-Policy: strict-origin-when-cross-origin`;
    `X-Content-Type-Options: nosniff`; `Permissions-Policy` restrictiva.
12. ✅ **CSRF** (H10): en todas las rutas `POST` con cookies, exigir
    `Content-Type: application/json` y que `Origin` sea el dominio de la tienda.
13. **Imágenes** (H13): limitar `remotePatterns` a Cloudinary y los dominios propios.
14. **Reportes generados**: pedir al generador URLs firmadas o con caducidad para los
    PDF, en lugar de enlaces públicos permanentes.
15. **Minimización de datos**: dejar de enviar teléfono y fecha de nacimiento a los
    webhooks externos que no los usen; definir retención (p. ej. borrar
    `customerBirthDate` y datos de reportes de terceros a los 12 meses) y publicarlo
    en el aviso de privacidad (LFPDPPP: datos de terceros como pareja o regalo).
16. **Monitoreo**: alertas en Vercel por picos de 401/429 en login, de pedidos
    `pending` por hora y de firmas inválidas en webhooks.

### Verificación sugerida tras aplicar
- Abrir `/checkout/success?order=<id real>` en una ventana privada: no debe mostrar datos.
- En GA DebugView, la página de éxito debe llegar sin `order`.
- `curl` al cron y a los webhooks sin firma: 401.
- 20 `POST /api/checkout` seguidos desde una IP: los últimos deben dar 429.
- Dos descargas simultáneas con `downloadLimit = 1`: solo una debe pasar.
