// Meta Pixel (anuncios de Facebook/Instagram). No se carga nada de Meta hasta
// que el usuario acepta las cookies de publicidad; mientras tanto, los eventos
// de la página actual esperan en una cola y se envían al aceptar.

import { isAdminPanelPage } from './admin-panel'
import type { AnalyticsEventMap, AnalyticsEventName, EcommerceItem } from './events'

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: Fbq
  loaded: boolean
  version: string
  disablePushState?: boolean
  allowDuplicatePageViews?: boolean
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

type AnyEvent = {
  [K in AnalyticsEventName]: { event: K; params: AnalyticsEventMap[K] }
}[AnalyticsEventName]

export type MetaEvent = {
  name: string
  params: Record<string, unknown>
  eventId?: string
}

function commerceParams(params: { currency: string; value: number; items: EcommerceItem[] }) {
  return {
    currency: params.currency,
    value: params.value,
    content_type: 'product',
    content_ids: params.items.map((i) => i.item_id),
    contents: params.items.map((i) => ({
      id: i.item_id,
      quantity: i.quantity ?? 1,
      item_price: i.price
    })),
    num_items: params.items.reduce((n, i) => n + (i.quantity ?? 1), 0)
  }
}

/**
 * Traduce un evento GA4 al evento estándar de Meta equivalente. Los que no
 * tienen equivalente (view_item_list, view_cart, etc.) se quedan solo en GA.
 */
export function toMetaEvent({ event, params }: AnyEvent): MetaEvent | null {
  switch (event) {
    case 'view_item':
      return {
        name: 'ViewContent',
        params: {
          ...commerceParams(params),
          content_name: params.items[0]?.item_name,
          content_category: params.items[0]?.item_category
        }
      }
    case 'add_to_cart':
      return { name: 'AddToCart', params: commerceParams(params) }
    case 'begin_checkout':
      return { name: 'InitiateCheckout', params: commerceParams(params) }
    case 'add_payment_info':
      return { name: 'AddPaymentInfo', params: commerceParams(params) }
    case 'purchase':
      // Mismo eventID que manda el servidor al confirmarse el pago (lib/meta-capi.ts):
      // Meta cuenta la compra una sola vez.
      return {
        name: 'Purchase',
        params: commerceParams(params),
        eventId: `purchase-${params.transaction_id}`
      }
    default:
      return null
  }
}

type QueuedCall = { path: string; args: unknown[] }

/** Datos del comprador para la coincidencia avanzada (el Pixel los cifra antes de enviarlos). */
export type MetaUserDataInput = {
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  externalId?: string | null
}

let consented = false
let pending: QueuedCall[] = []
let lastPageView = ''
let userData: Record<string, string> = {}
let initializedWith = ''

/** Eventos que también se mandan al servidor (API de Conversiones). */
const MIRRORED = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo'])

function newEventId(name: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `${name.toLowerCase()}-${random}`
}

const clean = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()

/**
 * Formato de coincidencia avanzada del Pixel (en minúsculas, sin espacios; el
 * Pixel aplica el hash). Valores que ya vienen en SHA-256 se pasan tal cual.
 */
export function toPixelUserData(input: MetaUserDataInput): Record<string, string> {
  const phoneDigits = (input.phone ?? '').replace(/\D/g, '')
  const phone = phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits
  const country = clean(input.country)
  const data: Record<string, string> = {
    em: clean(input.email),
    ph: phone,
    fn: clean(input.firstName),
    ln: clean(input.lastName),
    ct: clean(input.city).replace(/\s+/g, ''),
    st: clean(input.state).replace(/\s+/g, ''),
    zp: clean(input.postalCode).replace(/\s+/g, ''),
    country: country === 'mexico' || country === 'méxico' ? 'mx' : country,
    external_id: clean(input.externalId)
  }
  for (const key of Object.keys(data)) if (!data[key]) delete data[key]
  return data
}

/**
 * Guarda los datos del comprador para la coincidencia avanzada. Si el Pixel ya
 * cargó, se vuelve a inicializar con ellos (así lo indica Meta para actualizar
 * los datos en la misma página).
 */
export function setMetaUserData(input: MetaUserDataInput) {
  const next = { ...userData, ...toPixelUserData(input) }
  if (JSON.stringify(next) === JSON.stringify(userData)) return
  userData = next
  if (consented && META_PIXEL_ID && typeof window !== 'undefined' && window.fbq) {
    initPixel(window.fbq, META_PIXEL_ID)
  }
}

/**
 * Igual que setMetaUserData pero con valores ya cifrados en SHA-256 por el
 * servidor (p. ej. en la página de compra exitosa, donde los datos vienen del
 * pedido y no deben viajar en claro al navegador).
 */
export function setMetaHashedUserData(hashed: Record<string, string>) {
  const valid: Record<string, string> = {}
  for (const [key, value] of Object.entries(hashed)) {
    if (/^[a-f0-9]{64}$/.test(value)) valid[key] = value
  }
  const next = { ...userData, ...valid }
  if (JSON.stringify(next) === JSON.stringify(userData)) return
  userData = next
  if (consented && META_PIXEL_ID && typeof window !== 'undefined' && window.fbq) {
    initPixel(window.fbq, META_PIXEL_ID)
  }
}

function initPixel(fbq: Fbq, pixelId: string) {
  const key = JSON.stringify(userData)
  if (key === initializedWith && fbq.loaded) return
  initializedWith = key
  if (Object.keys(userData).length) fbq('init', pixelId, userData)
  else fbq('init', pixelId)
}

/** Copia del evento a la API de Conversiones de la tienda (mismo eventID). */
function mirrorToServer(args: unknown[]) {
  const [kind, name, params, options] = args as [string, string, Record<string, unknown>?, { eventID?: string }?]
  if (kind !== 'track' || !MIRRORED.has(name) || !options?.eventID) return
  try {
    void fetch('/api/meta/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event_name: name,
        event_id: options.eventID,
        event_source_url: window.location.href.split('#')[0],
        custom_data: params ?? {},
        user: userData
      })
    }).catch(() => {})
  } catch {
    // nunca romper la página por métricas
  }
}

function loadPixel(pixelId: string): Fbq {
  if (window.fbq) return window.fbq
  // Mismo stub que el snippet oficial: encola las llamadas hasta que carga fbevents.js.
  const fbq = function () {
    // eslint-disable-next-line prefer-rest-params
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments as never)
    // eslint-disable-next-line prefer-rest-params
    else fbq.queue.push(arguments)
  } as Fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  // Los page views los manda RouteTracker: se apaga el PageView automático por
  // navegación y se permite más de uno por carga (si no, Meta descarta los siguientes).
  fbq.disablePushState = true
  fbq.allowDuplicatePageViews = true
  window.fbq = fbq
  window._fbq = fbq
  initializedWith = ''
  initPixel(fbq, pixelId)

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  return fbq
}

function send(args: unknown[]) {
  if (!META_PIXEL_ID || typeof window === 'undefined') return
  // El panel no cuenta como visita a la tienda ni manda sus URLs a Meta.
  if (isAdminPanelPage()) return
  const path = window.location.pathname
  if (consented) {
    loadPixel(META_PIXEL_ID)(...args)
    mirrorToServer(args)
    return
  }
  // El pixel usa la URL del momento del envío: lo de páginas anteriores ya no sirve.
  pending = pending.filter((call) => call.path === path)
  pending.push({ path, args })
}

export function metaPageView() {
  if (typeof window === 'undefined') return
  // Un mismo page view registrado dos veces (p. ej. efectos dobles de React) cuenta una vez.
  const url = window.location.pathname + window.location.search
  if (url === lastPageView) return
  lastPageView = url
  send(['track', 'PageView'])
}

export function metaTrack<K extends AnalyticsEventName>(event: K, params: AnalyticsEventMap[K]) {
  const mapped = toMetaEvent({ event, params } as AnyEvent)
  if (!mapped) return
  // Cada evento lleva su eventID para que Meta lo deduplique contra la copia
  // del servidor (la nuestra y la de la API hospedada por Meta).
  send(['track', mapped.name, mapped.params, { eventID: mapped.eventId ?? newEventId(mapped.name) }])
}

export function setMetaConsent(granted: boolean) {
  if (!META_PIXEL_ID || typeof window === 'undefined') return
  if (!granted) {
    if (consented) window.fbq?.('consent', 'revoke')
    consented = false
    pending = []
    return
  }
  if (consented) return
  consented = true
  window.fbq?.('consent', 'grant')
  // PageView primero, como en el snippet oficial.
  const path = window.location.pathname
  const queued = pending
    .filter((call) => call.path === path)
    .sort((a, b) => Number(b.args[1] === 'PageView') - Number(a.args[1] === 'PageView'))
  pending = []
  for (const call of queued) send(call.args)
}
