'use client'

import { useEffect, useRef } from 'react'

import { track, type EcommerceItem } from '@/lib/analytics'

// Dispara view_item_list una única vez al montar. Se usa por cada sección/
// carrusel de productos del home o categoría.
export function ListingTracker({
  items,
  listId,
  listName
}: {
  items: EcommerceItem[]
  listId?: string
  listName?: string
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current || items.length === 0) return
    fired.current = true
    track('view_item_list', {
      item_list_id: listId,
      item_list_name: listName,
      items
    })
  }, [items, listId, listName])
  return null
}
