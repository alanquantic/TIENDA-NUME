'use client'

import { useEffect, useRef } from 'react'

import { track, type EcommerceItem } from '@/lib/analytics'

// Dispara view_item una única vez al montar la ficha del producto.
export function ProductViewTracker({
  item,
  currency,
  value
}: {
  item: EcommerceItem
  currency: string
  value: number
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track('view_item', { currency, value, items: [item] })
  }, [item, currency, value])
  return null
}
