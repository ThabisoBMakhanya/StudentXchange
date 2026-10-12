import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../types';

interface CartState {
  items: CartItem[];
  addItem: (listingId: string, quantity?: number) => void;
  removeItem: (listingId: string) => void;
  setQuantity: (listingId: string, quantity: number) => void;
  clear: () => void;
  count: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (listingId, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.listingId === listingId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.listingId === listingId ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...state.items, { listingId, quantity }] };
        }),
      removeItem: (listingId) =>
        set((state) => ({ items: state.items.filter((i) => i.listingId !== listingId) })),
      setQuantity: (listingId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.listingId !== listingId)
              : state.items.map((i) => (i.listingId === listingId ? { ...i, quantity } : i)),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'sx-cart' },
  ),
);
