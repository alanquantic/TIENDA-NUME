// API de Conversiones de Meta (lado servidor).
//
// Complementa al Pixel del navegador: los mismos eventos se mandan también
// desde el servidor con el MISMO event_id, y Meta los deduplica. Así se cuentan
// las visitas y compras de quien tiene bloqueador de anuncios o un navegador
// que limita el rastreo, y cada evento llega con más datos para reconocer a la
// persona (calidad de coincidencia).
//
// Este archivo es puro (sin red ni BD) para poder probarlo; el envío está en
// `meta-capi-send.ts`.
//
// Normalización y hash según
// https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters

import { createHash } from 'node:crypto';

export type MetaUserInput = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  birthDate?: string | null; // YYYY-MM-DD
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

/** user_data tal como lo pide la API (valores en hash donde corresponde). */
export type MetaUserData = {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  db?: string[];
  external_id?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
};

export type MetaServerEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: 'website';
  event_source_url?: string;
  user_data: MetaUserData;
  custom_data?: Record<string, unknown>;
};

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Quita acentos y todo lo que no sea letra (Meta lo pide así para nombres y ciudad). */
function lettersOnly(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Teléfono solo con dígitos y con lada de país. Los de 10 dígitos son de México
 * (la tienda vende a México), así que se les antepone 52.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  let digits = (value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  digits = digits.replace(/^00/, '');
  if (digits.length === 10) digits = `52${digits}`;
  // 52 1 XXXXXXXXXX (formato viejo de celulares) → 52 XXXXXXXXXX
  if (digits.length === 13 && digits.startsWith('521')) digits = `52${digits.slice(3)}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function normalizeName(value: string | null | undefined): string | null {
  const name = lettersOnly(value ?? '');
  return name || null;
}

export function normalizePostalCode(value: string | null | undefined): string | null {
  const zip = (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return zip || null;
}

const COUNTRY_NAMES: Record<string, string> = {
  mexico: 'mx',
  mx: 'mx',
  estadosunidos: 'us',
  usa: 'us',
  us: 'us',
};

export function normalizeCountry(value: string | null | undefined): string | null {
  const key = lettersOnly(value ?? '');
  if (!key) return null;
  if (COUNTRY_NAMES[key]) return COUNTRY_NAMES[key];
  return key.length === 2 ? key : null;
}

/** YYYY-MM-DD → YYYYMMDD. */
export function normalizeBirthDate(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}${match[2]}${match[3]}` : null;
}

function hashed(value: string | null): string[] | undefined {
  return value ? [sha256(value)] : undefined;
}

/** Arma user_data: cifra los datos personales y deja tal cual IP, navegador y cookies de Meta. */
export function buildUserData(input: MetaUserInput): MetaUserData {
  const data: MetaUserData = {
    em: hashed(normalizeEmail(input.email)),
    ph: hashed(normalizePhone(input.phone)),
    fn: hashed(normalizeName(input.firstName)),
    ln: hashed(normalizeName(input.lastName)),
    ct: hashed(normalizeName(input.city)),
    st: hashed(normalizeName(input.state)),
    zp: hashed(normalizePostalCode(input.postalCode)),
    country: hashed(normalizeCountry(input.country)),
    db: hashed(normalizeBirthDate(input.birthDate)),
    external_id: input.externalId?.trim() ? [sha256(input.externalId.trim().toLowerCase())] : undefined,
    client_ip_address: input.clientIp?.trim() || undefined,
    client_user_agent: input.userAgent?.trim() || undefined,
    fbp: isFbCookie(input.fbp) ? input.fbp! : undefined,
    fbc: isFbCookie(input.fbc) ? input.fbc! : undefined,
  };
  for (const key of Object.keys(data) as (keyof MetaUserData)[]) {
    if (data[key] === undefined) delete data[key];
  }
  return data;
}

/** _fbp / _fbc tienen la forma fb.<n>.<timestamp>.<valor>. */
export function isFbCookie(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^fb\.\d\.\d+\.\S+$/.test(value) && value.length < 500;
}

/**
 * fbc a partir del fbclid del anuncio, para cuando la cookie _fbc todavía no
 * existe (p. ej. el Pixel no cargó). Formato: fb.1.<ms>.<fbclid>.
 */
export function fbcFromClickId(fbclid: string | null | undefined, now = Date.now()): string | null {
  const id = fbclid?.trim();
  return id && /^[\w-]{10,500}$/.test(id) ? `fb.1.${now}.${id}` : null;
}

/** Primera IP de x-forwarded-for (la del visitante en Vercel). */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || null;
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return null;
}

/** ¿El visitante aceptó cookies de publicidad? (cookie del banner de la tienda). */
export function hasAdConsent(cookieHeader: string | null): boolean {
  const raw = readCookie(cookieHeader, 'tienda_consent');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { s?: { ad_storage?: string } };
    return parsed?.s?.ad_storage === 'granted';
  } catch {
    return false;
  }
}

export type MetaRequestContext = {
  clientIp: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  adConsent: boolean;
};

/** Lo que se toma de la petición del visitante para enriquecer el evento. */
export function requestContext(req: Request, fbclid?: string | null): MetaRequestContext {
  const cookies = req.headers.get('cookie');
  return {
    clientIp: clientIpFrom(req.headers),
    userAgent: req.headers.get('user-agent'),
    fbp: readCookie(cookies, '_fbp'),
    fbc: readCookie(cookies, '_fbc') ?? fbcFromClickId(fbclid),
    adConsent: hasAdConsent(cookies),
  };
}

export type MetaOrderLike = {
  number: string;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPhone: string | null;
  customerBirthDate: string | null;
  userId: string | null;
  currency: string;
  totalAmount: string;
  shippingAddress: unknown;
  paidAt: Date | null;
  metadata: unknown;
};

export type MetaOrderItemLike = {
  variantId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unitAmount: string;
};

/** Contexto del visitante guardado en el pedido al crear el checkout. */
export type StoredMetaContext = {
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  adConsent?: boolean;
  sourceUrl?: string | null;
};

export function storedMetaContext(metadata: unknown): StoredMetaContext | null {
  const meta = (metadata as { meta?: StoredMetaContext } | null)?.meta;
  return meta && typeof meta === 'object' ? meta : null;
}

/**
 * Evento Purchase del servidor para un pedido pagado. Usa el mismo event_id que
 * el navegador (`purchase-<número>`), así Meta cuenta la compra una sola vez.
 */
export function buildPurchaseEvent(
  order: MetaOrderLike,
  items: MetaOrderItemLike[],
  opts: { appUrl: string },
): MetaServerEvent {
  const ctx = storedMetaContext(order.metadata) ?? {};
  const address = (order.shippingAddress ?? {}) as {
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  const contents = items.map((item) => ({
    id: item.variantId ?? item.productId ?? item.name,
    quantity: item.quantity,
    item_price: Number.parseFloat(item.unitAmount) || 0,
  }));
  return {
    event_name: 'Purchase',
    event_time: Math.floor((order.paidAt ?? new Date()).getTime() / 1000),
    event_id: `purchase-${order.number}`,
    action_source: 'website',
    event_source_url: ctx.sourceUrl ?? `${opts.appUrl.replace(/\/+$/, '')}/checkout/success`,
    user_data: buildUserData({
      email: order.customerEmail,
      phone: order.customerPhone,
      firstName: order.customerFirstName,
      lastName: order.customerLastName,
      birthDate: order.customerBirthDate,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country ?? 'mx',
      externalId: order.userId ?? order.customerEmail,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      fbp: ctx.fbp,
      fbc: ctx.fbc,
    }),
    custom_data: {
      currency: order.currency,
      value: Number.parseFloat(order.totalAmount) || 0,
      content_type: 'product',
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.reduce((n, c) => n + c.quantity, 0),
      order_id: order.number,
    },
  };
}

/** Eventos del embudo que el navegador también manda al servidor. */
export const BROWSER_MIRRORED_EVENTS = new Set([
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'AddPaymentInfo',
]);

/** Lo que manda el navegador a /api/meta/events. */
export type BrowserMirrorBody = {
  event_name?: unknown;
  event_id?: unknown;
  event_source_url?: unknown;
  custom_data?: unknown;
  user?: unknown;
};

const CUSTOM_DATA_KEYS = [
  'currency',
  'value',
  'content_type',
  'content_ids',
  'contents',
  'num_items',
  'content_name',
  'content_category',
] as const;

function pickCustomData(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of CUSTOM_DATA_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  if (Array.isArray(out.content_ids)) out.content_ids = out.content_ids.slice(0, 50).map(String);
  if (Array.isArray(out.contents)) out.contents = out.contents.slice(0, 50);
  if (typeof out.value !== 'number' || !Number.isFinite(out.value)) delete out.value;
  return out;
}

function str(value: unknown, max = 300): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * Valida la copia de un evento del navegador y la convierte en evento de
 * servidor. Devuelve null si no es un evento del embudo o viene mal formado.
 * Solo acepta URLs de la propia tienda.
 */
export function buildBrowserMirrorEvent(
  body: BrowserMirrorBody,
  ctx: MetaRequestContext,
  opts: { appHost: string; now?: number },
): MetaServerEvent | null {
  const name = str(body.event_name, 40);
  const eventId = str(body.event_id, 120);
  if (!name || !BROWSER_MIRRORED_EVENTS.has(name) || !eventId || !/^[\w.:-]+$/.test(eventId)) return null;

  let sourceUrl: string | undefined;
  const rawUrl = str(body.event_source_url, 1000);
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.host === opts.appHost) sourceUrl = url.toString();
    } catch {
      sourceUrl = undefined;
    }
  }
  if (!sourceUrl) return null;

  const user = (body.user && typeof body.user === 'object' ? body.user : {}) as Record<string, unknown>;
  return {
    event_name: name,
    event_time: Math.floor((opts.now ?? Date.now()) / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: sourceUrl,
    user_data: buildUserData({
      email: str(user.em),
      phone: str(user.ph),
      firstName: str(user.fn),
      lastName: str(user.ln),
      city: str(user.ct),
      state: str(user.st),
      postalCode: str(user.zp),
      country: str(user.country),
      externalId: str(user.external_id),
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      fbp: ctx.fbp,
      fbc: ctx.fbc,
    }),
    custom_data: pickCustomData(body.custom_data),
  };
}

/** user_data cifrado → formato del Pixel (un valor por campo, sin IP/navegador/cookies). */
export function pixelHashedUserData(data: MetaUserData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'db', 'external_id'] as const) {
    const value = data[key]?.[0];
    if (value) out[key] = value;
  }
  return out;
}
