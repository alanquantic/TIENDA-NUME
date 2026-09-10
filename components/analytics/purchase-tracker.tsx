'use client'

import { useEffect, useRef } from 'react'

import { track, type EcommerceItem } from '@/lib/analytics'

const STORAGE_KEY = 'tienda_purchase_fired'

// Dispara purchase una única vez por transaction_id. Usa sessionStorage +
// localStorage para tolerar refresh y "volver atrás" del navegador.
export function PurchaseTracker({
  transactionId,
  currency,
  value,
  items,
  tax,
  shipping,
  coupon
}: {
  transactionId: string
  currency: string
  value: number
  items: EcommerceItem[]
  tax?: number
  shipping?: number
  coupon?: string
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current || !transactionId) return
    fired.current = true

    try {
      const key = `${STORAGE_KEY}:${transactionId}`
      const already =
        (typeof localStorage !== 'undefined' && localStorage.getItem(key)) ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key))
      if (already) return

      track('purchase', {
        transaction_id: transactionId,
        currency,
        value,
        items,
        ...(typeof tax === 'number' ? { tax } : {}),
        ...(typeof shipping === 'number' ? { shipping } : {}),
        ...(coupon ? { coupon } : {})
      })

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, String(Date.now()))
      }
    } catch {
      // no romper el render si storage falla
    }
  }, [transactionId, currency, value, items, tax, shipping, coupon])

  return null
}
