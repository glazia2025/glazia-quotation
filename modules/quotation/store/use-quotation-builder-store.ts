"use client";

import { create } from "zustand";

import { calculateQuotationTotals } from "@/modules/quotation/utils/calculations";
import { createDefaultItem, createEmptyQuotation } from "@/modules/quotation/utils/factory";
import type { Quotation, QuotationItem } from "@/types/quotation";

const getQuotationItemIdentity = (item: QuotationItem | null | undefined) => {
  if (!item) return "";
  const withBackendId = item as QuotationItem & { _id?: string };
  return String(item.id || withBackendId._id || item.refCode || "");
};

interface QuotationBuilderState {
  quotation: Quotation;
  selectedItemId: string | null;
  taxPercent: number;
  globalDiscount: number;
  lastSavedAt: string | null;
  resetQuotation: () => void;
  setQuotation: (quotation: Quotation) => void;
  updateCustomer: (key: keyof Quotation["customerDetails"], value: string) => void;
  updateQuotationField: (key: keyof Quotation["quotationDetails"], value: string) => void;
  updateItem: (itemId: string, patch: Partial<QuotationItem>) => void;
  addItem: (itemId?: string) => string;
  ensureItem: (itemId: string) => void;
  duplicateItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  selectItem: (itemId: string) => void;
  setPricingMeta: (taxPercent: number, globalDiscount: number) => void;
  markSaved: () => void;
  reorderItems: (startIndex: number, endIndex: number) => void;
}

export const useQuotationBuilderStore = create<QuotationBuilderState>()((set, get) => ({
  quotation: createEmptyQuotation(),
  selectedItemId: null,
  taxPercent: 18,
  globalDiscount: 0,
  lastSavedAt: null,
  resetQuotation: () =>
    set({
      quotation: createEmptyQuotation(),
      selectedItemId: null,
      taxPercent: 18,
      globalDiscount: 0,
      lastSavedAt: null,
    }),
  setQuotation: (quotation) =>
    set({
      quotation,
      selectedItemId: quotation.items[0]?.id ?? null
    }),
  updateCustomer: (key, value) =>
    set((state) => ({
      quotation: {
        ...state.quotation,
        customerDetails: {
          ...createEmptyQuotation().customerDetails,
          ...state.quotation.customerDetails,
          [key]: value
        }
      }
    })),
  updateQuotationField: (key, value) =>
    set((state) => ({
      quotation: {
        ...state.quotation,
        quotationDetails: {
          ...state.quotation.quotationDetails,
          [key]: value
        }
      }
    })),
  updateItem: (itemId, patch) =>
    set((state) => ({
      quotation: {
        ...state.quotation,
        items: state.quotation.items.map((item) => (getQuotationItemIdentity(item) === itemId ? { ...item, ...patch } : item))
      }
    })),
  addItem: (itemId) => {
    const next = createDefaultItem(itemId);

    set((state) => ({
      quotation: {
        ...state.quotation,
        items: [...state.quotation.items, next]
      },
      selectedItemId: next.id
    }));

    return next.id;
  },
  ensureItem: (itemId) =>
    set((state) => {
      const exists = state.quotation.items.some((item) => getQuotationItemIdentity(item) === itemId);
      if (exists) return state;

      const next = createDefaultItem(itemId);
      return {
        quotation: {
          ...state.quotation,
          items: [...state.quotation.items, next]
        },
        selectedItemId: itemId
      };
    }),
  duplicateItem: (itemId) =>
    set((state) => {
      const item = state.quotation.items.find((entry) => getQuotationItemIdentity(entry) === itemId);
      if (!item) return state;
      const duplicate = { ...item, id: crypto.randomUUID(), projectLocation: `${item.projectLocation} Copy` };
      return {
        quotation: {
          ...state.quotation,
          items: [...state.quotation.items, duplicate]
        },
        selectedItemId: duplicate.id
      };
    }),
  removeItem: (itemId) =>
    set((state) => {
      const items = state.quotation.items.filter((item) => getQuotationItemIdentity(item) !== itemId);
      return {
        quotation: {
          ...state.quotation,
          items: items.length ? items : state.quotation.items
        },
        selectedItemId: items[0]?.id ?? state.selectedItemId
      };
    }),
  selectItem: (itemId) => set({ selectedItemId: itemId }),
  setPricingMeta: (taxPercent, globalDiscount) => set({ taxPercent, globalDiscount }),
  markSaved: () => set({ lastSavedAt: new Date().toISOString() }),
  reorderItems: (startIndex, endIndex) =>
    set((state) => {
      const items = Array.from(state.quotation.items);

      const [removed] = items.splice(startIndex, 1);
      items.splice(endIndex, 0, removed);

      return {
        quotation: {
          ...state.quotation,
          items
        }
      };
    })
}));
