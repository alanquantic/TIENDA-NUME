'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string | null;
  /** Snapshot decimal solo para mostrar. El precio real se recalcula en el server. */
  priceAmount: string;
  currency: string;
  image: string | null;
  type: 'digital' | 'physical';
  quantity: number;
  /** Stock máximo para físicos; null = sin límite (digital). */
  maxStock: number | null;
  /** Tope de unidades por pedido (membresías, licencias…); null = sin tope. */
  maxPerOrder?: number | null;
};

/** Tope efectivo de un ítem: el menor entre stock y límite por pedido. */
export function itemCap(item: Pick<CartItem, 'maxStock' | 'maxPerOrder'>): number {
  return Math.min(item.maxStock ?? Infinity, item.maxPerOrder ?? Infinity);
}

type ReconcileResult = { removed: number; remapped: number };

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  remove: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  totalItems: () => number;
  /** Sincroniza el carrito con el catálogo actual (quita/reasigna items obsoletos). */
  reconcile: () => Promise<ReconcileResult>;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          const cap = itemCap(item);
          if (existing) {
            const next = Math.min(existing.quantity + quantity, cap);
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, quantity: next } : i,
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: Math.min(quantity, cap) }],
          };
        }),
      remove: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) => {
              if (i.variantId !== variantId) return i;
              const cap = itemCap(i);
              return { ...i, quantity: Math.max(1, Math.min(quantity, cap)) };
            })
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [] }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      reconcile: async () => {
        const items = get().items;
        if (items.length === 0) return { removed: 0, remapped: 0 };
        try {
          const res = await fetch('/api/cart/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lines: items.map((i) => ({ variantId: i.variantId, slug: i.slug })),
            }),
          });
          if (!res.ok) return { removed: 0, remapped: 0 };
          const data = (await res.json()) as {
            lines: Array<{ status: 'ok' | 'remapped' | 'removed'; variantId: string; data?: Partial<CartItem> }>;
          };
          const byVariant = new Map(data.lines.map((l) => [l.variantId, l]));

          let removed = 0;
          let remapped = 0;
          const next: CartItem[] = [];
          for (const item of items) {
            const r = byVariant.get(item.variantId);
            if (!r || r.status === 'removed' || !r.data) {
              removed++;
              continue;
            }
            const merged = { ...item, ...r.data } as CartItem;
            const cap = itemCap(merged);
            if (Number.isFinite(cap) && cap > 0) {
              merged.quantity = Math.min(item.quantity, cap);
            }
            next.push(merged);
            if (r.status === 'remapped') remapped++;
          }
          set({ items: next });
          return { removed, remapped };
        } catch {
          return { removed: 0, remapped: 0 };
        }
      },
    }),
    { name: 'tienda-cart' },
  ),
);
