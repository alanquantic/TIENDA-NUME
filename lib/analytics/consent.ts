// Consent Mode v2. Pixeles con estados "denied" por defecto y se activan tras
// aceptar el banner.

export type ConsentState = 'granted' | 'denied'

export type ConsentSettings = {
  ad_storage: ConsentState
  analytics_storage: ConsentState
  ad_user_data: ConsentState
  ad_personalization: ConsentState
  functionality_storage: ConsentState
  security_storage: ConsentState
}

export const CONSENT_COOKIE = 'tienda_consent'
export const CONSENT_VERSION = 1

export const DEFAULT_DENIED: ConsentSettings = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted'
}

export const ALL_GRANTED: ConsentSettings = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functionality_storage: 'granted',
  security_storage: 'granted'
}

export type StoredConsent = {
  v: number
  ts: number
  s: ConsentSettings
}

export function readConsent(): StoredConsent | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`))
  if (!match) return null
  try {
    const value = decodeURIComponent(match.split('=')[1] ?? '')
    const parsed = JSON.parse(value) as StoredConsent
    if (parsed.v !== CONSENT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function writeConsent(settings: ConsentSettings) {
  if (typeof document === 'undefined') return
  const payload: StoredConsent = { v: CONSENT_VERSION, ts: Date.now(), s: settings }
  const value = encodeURIComponent(JSON.stringify(payload))
  const maxAge = 60 * 60 * 24 * 180
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}
