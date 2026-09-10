// Helpers para convertir tipos internos del catálogo/carrito al formato de
// items estándar de GA4 (EcommerceItem).

import type { CartItem } from '@/lib/cart-store'
import type { CatalogCard } from '@/lib/queries'
import type { EcommerceItem } from './events'

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'MXN'

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export function cartItemToGaItem(item: CartItem, index?: number): EcommerceItem {
  return {
    item_id: item.variantId,
    item_name: item.name,
    item_variant: item.variantName ?? undefined,
    item_category: item.type === 'digital' ? 'digital' : 'physical',
    price: toNumber(item.priceAmount),
    quantity: item.quantity,
    currency: item.currency,
    ...(typeof index === 'number' ? { index } : {})
  }
}

export function catalogCardToGaItem(
  card: CatalogCard,
  listContext?: { list_id?: string; list_name?: string; index?: number }
): EcommerceItem {
  return {
    item_id: card.variantId,
    item_name: card.name,
    item_category: card.categoryName ?? (card.type === 'digital' ? 'digital' : 'physical'),
    price: toNumber(card.priceAmount),
    quantity: 1,
    currency: card.currency,
    ...(listContext?.list_id ? { item_list_id: listContext.list_id } : {}),
    ...(listContext?.list_name ? { item_list_name: listContext.list_name } : {}),
    ...(typeof listContext?.index === 'number' ? { index: listContext.index } : {})
  }
}

export function itemsValue(items: EcommerceItem[]): number {
  return items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 1), 0)
}

export function inferCurrency(items: EcommerceItem[]): string {
  return items[0]?.currency || DEFAULT_CURRENCY
}
