// Meta Pixel (anuncios de Facebook/Instagram). No se carga nada de Meta hasta
// que el usuario acepta las cookies de publicidad; mientras tanto, los eventos
// de la página actual esperan en una cola y se envían al aceptar.

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
      // El eventID permite deduplicar contra la Conversions API si se agrega.
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

let consented = false
let pending: QueuedCall[] = []
let lastPageView = ''

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
  fbq('init', pixelId)

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  return fbq
}

function send(args: unknown[]) {
  if (!META_PIXEL_ID || typeof window === 'undefined') return
  // El panel no cuenta como visita a la tienda ni manda sus URLs a Meta.
  const path = window.location.pathname
  if (path.startsWith('/admin')) return
  if (consented) {
    loadPixel(META_PIXEL_ID)(...args)
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
  send(
    mapped.eventId
      ? ['track', mapped.name, mapped.params, { eventID: mapped.eventId }]
      : ['track', mapped.name, mapped.params]
  )
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
