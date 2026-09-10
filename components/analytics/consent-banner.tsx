'use client'

import { useEffect, useState } from 'react'

import {
  ALL_GRANTED,
  DEFAULT_DENIED,
  readConsent,
  updateConsent,
  writeConsent,
  type ConsentSettings
} from '@/lib/analytics'

export function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = readConsent()
    if (stored) {
      updateConsent(stored.s)
      return
    }
    setVisible(true)
  }, [])

  function persist(settings: ConsentSettings) {
    writeConsent(settings)
    updateConsent(settings)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-xl sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-sm text-[hsl(var(--foreground))]">
          <p className="font-semibold">Usamos cookies</p>
          <p className="mt-1 leading-6 text-[hsl(var(--muted-foreground))]">
            Utilizamos cookies para analizar el uso del sitio y mejorar tu experiencia.
            Puedes aceptarlas o rechazar las opcionales.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2 sm:flex-nowrap">
          <button
            type="button"
            onClick={() => persist(DEFAULT_DENIED)}
            className="rounded-full border border-[hsl(var(--border))] bg-transparent px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => persist(ALL_GRANTED)}
            className="rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  )
}
