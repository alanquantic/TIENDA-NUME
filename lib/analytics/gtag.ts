import type { AnalyticsEventMap, AnalyticsEventName } from './events'
import type { ConsentSettings } from './consent'
import { isAdminPanelPage } from './admin-panel'
import { metaPageView, metaTrack, setMetaConsent } from './meta-pixel'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID

function gtag(...args: unknown[]) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push(args)
    return
  }
  window.gtag(...args)
}

export function track<K extends AnalyticsEventName>(
  event: K,
  params: AnalyticsEventMap[K]
) {
  if (isAdminPanelPage()) return
  gtag('event', event, params as Record<string, unknown>)
  metaTrack(event, params)
}

export function updateConsent(settings: ConsentSettings) {
  gtag('consent', 'update', settings)
  setMetaConsent(settings.ad_storage === 'granted')
}

/**
 * Parámetros de URL que sí pueden llegar a GA (atribución de campañas). Todo lo
 * demás se descarta: ids de pedido, tokens o parámetros de las pasarelas.
 */
const ALLOWED_PARAMS = /^(utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid)$/

export function sanitizeUrl(url: string): string {
  const parsed = new URL(url, 'https://placeholder.invalid')
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (!ALLOWED_PARAMS.test(key)) parsed.searchParams.delete(key)
  }
  parsed.hash = ''
  const isAbsolute = /^https?:\/\//.test(url)
  return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}`
}

export function pageView(url: string, title?: string) {
  if (isAdminPanelPage()) return
  metaPageView()
  if (!GA_MEASUREMENT_ID) return
  const pageLocation = sanitizeUrl(typeof window !== 'undefined' ? window.location.href : url)
  // Fija la URL limpia también para los eventos siguientes (purchase, etc.).
  gtag('set', { page_location: pageLocation })
  gtag('event', 'page_view', {
    page_path: sanitizeUrl(url),
    page_location: pageLocation,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : undefined),
    send_to: GA_MEASUREMENT_ID
  })
}

export function setUserId(userId: string | null) {
  gtag('set', { user_id: userId ?? undefined })
}
