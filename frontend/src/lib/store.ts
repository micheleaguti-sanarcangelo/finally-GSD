"use client";

import { create } from "zustand";

export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: "up" | "down" | "flat";
}

interface PriceStore {
  prices: Record<string, PriceUpdate>;
  status: "CONNECTING" | "OPEN" | "CLOSED";
  setPrices: (updates: Record<string, PriceUpdate>) => void;
  setStatus: (status: PriceStore["status"]) => void;
}

export const usePriceStore = create<PriceStore>()((set) => ({
  prices: {},
  status: "CONNECTING",
  setPrices: (updates) =>
    set((state) => ({ prices: { ...state.prices, ...updates } })),
  setStatus: (status) => set({ status }),
}));
