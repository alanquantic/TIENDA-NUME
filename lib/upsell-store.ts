'use client';

import { create } from 'zustand';
import type { UpsellTarget } from './agenda-upsell';

export type UpsellOffer = UpsellTarget & { productName: string };

type UpsellState = {
  offer: UpsellOffer | null;
  show: (offer: UpsellOffer) => void;
  dismiss: () => void;
};

export const useUpsell = create<UpsellState>((set) => ({
  offer: null,
  show: (offer) => set({ offer }),
  dismiss: () => set({ offer: null }),
}));
