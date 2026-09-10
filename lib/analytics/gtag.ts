import type { AnalyticsEventMap, AnalyticsEventName } from './events'
import type { ConsentSettings } from './consent'

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
  gtag('event', event, params as Record<string, unknown>)
}

export function updateConsent(settings: ConsentSettings) {
  gtag('consent', 'update', settings)
}

export function pageView(url: string, title?: string) {
  if (!GA_MEASUREMENT_ID) return
  gtag('event', 'page_view', {
    page_path: url,
    page_location: typeof window !== 'undefined' ? window.location.href : url,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : undefined),
    send_to: GA_MEASUREMENT_ID
  })
}

export function setUserId(userId: string | null) {
  gtag('set', { user_id: userId ?? undefined })
}
