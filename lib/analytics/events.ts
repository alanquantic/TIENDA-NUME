// Contrato de eventos GA4 para la tienda.

export type EcommerceItem = {
  item_id: string
  item_name: string
  item_category?: string
  item_variant?: string
  price?: number
  quantity?: number
  currency?: string
  item_brand?: string
  item_list_id?: string
  item_list_name?: string
  index?: number
}

export type AnalyticsEventMap = {
  page_view: { page_path: string; page_title?: string; page_location?: string }
  scroll_depth: { percent: 25 | 50 | 75 | 90 }

  // Navegación de catálogo
  view_item_list: { item_list_id?: string; item_list_name?: string; items: EcommerceItem[] }
  view_item: { currency: string; value: number; items: EcommerceItem[] }
  select_item: { item_list_id?: string; item_list_name?: string; items: EcommerceItem[] }

  // Carrito
  add_to_cart: { currency: string; value: number; items: EcommerceItem[] }
  remove_from_cart: { currency: string; value: number; items: EcommerceItem[] }
  view_cart: { currency: string; value: number; items: EcommerceItem[] }

  // Checkout
  begin_checkout: { currency: string; value: number; items: EcommerceItem[]; coupon?: string }
  add_shipping_info: {
    currency: string
    value: number
    items: EcommerceItem[]
    shipping_tier?: string
  }
  add_payment_info: {
    currency: string
    value: number
    items: EcommerceItem[]
    payment_type?: string
  }

  // Conversión
  purchase: {
    transaction_id: string
    currency: string
    value: number
    items: EcommerceItem[]
    tax?: number
    shipping?: number
    coupon?: string
  }
  refund: {
    transaction_id: string
    currency: string
    value: number
    items?: EcommerceItem[]
  }

  // Post-purchase / engagement
  invoice_requested: { transaction_id: string; rfc_hash?: string }
  report_input_provided: {
    report_kind: string
    has_partner: boolean
    input_date?: string
    input_year?: number
    input_month?: number
    input_day?: number
  }

  // Otros útiles
  view_promotion: { promotion_id?: string; promotion_name?: string; creative_slot?: string }
  select_promotion: { promotion_id?: string; promotion_name?: string; creative_slot?: string }
  sign_up: { method: string }
  login: { method: string }
  search: { search_term: string }
}

export type AnalyticsEventName = keyof AnalyticsEventMap
