"use client";

import { create } from "zustand";

import { calculateQuotationTotals } from "@/modules/quotation/utils/calculations";
import { createEmptyQuotation, createRevision } from "@/modules/quotation/utils/factory";
import type { Quotation, QuotationItem, QuotationStatus } from "@/types/quotation";

interface QuotationBuilderState {
  quotation: Quotation;
  selectedItemId: string | null;
  taxPercent: number;
  globalDiscount: number;
  lastSavedAt: string | null;
  setQuotation: (quotation: Quotation) => void;
  updateCustomer: (key: keyof Quotation["customer"], value: string) => void;
  updateQuotationField: (key:keyof Quotation, value: any) => void;
  updateItem: (itemId: string, patch: Partial<QuotationItem>) => void;
  // addItem: () => void;
  addItem: () => string;
  duplicateItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  selectItem: (itemId: string) => void;
  setStatus: (status: QuotationStatus) => void;
  setPricingMeta: (taxPercent: number, globalDiscount: number) => void;
  markSaved: () => void;
  addRevision: (summary: string) => void;
  rollbackToRevision: (revisionId: string) => void;
}

export const useQuotationBuilderStore = create<QuotationBuilderState>((set, get) => ({
  quotation: createEmptyQuotation(),
  selectedItemId: null,
  taxPercent: 18,
  globalDiscount: 0,
  lastSavedAt: null,
  setQuotation: (quotation) =>
    set({
      quotation,
      selectedItemId: quotation.items[0]?.id ?? null
    }),
  updateCustomer: (key, value) =>
    set((state) => ({
      quotation: {
        ...state.quotation,
        customer: {
          ...state.quotation.customer,
          [key]: value
        }
      }
    })),
  updateQuotationField: (key, value) =>
    set((state) => ({
      quotation: {
        ...state.quotation,
        [key]: value
      }
    })),
  updateItem: (itemId, patch) =>
    set((state) => ({
      quotation: {
        ...state.quotation,
        items: state.quotation.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      }
    })),
  // addItem: () =>
  //   set((state) => {
  //     const next = createEmptyQuotation({ items: [] }).items[0];
  //     return {
  //       quotation: {
  //         ...state.quotation,
  //         items: [...state.quotation.items, next]
  //       },
  //       selectedItemId: next.id
  //     };
      
  //   }),
  addItem: () => {
  const next = createEmptyQuotation({ items: [] }).items[0];

  set((state) => ({
    quotation: {
      ...state.quotation,
      items: [...state.quotation.items, next],
    },
    selectedItemId: next.id,
  }));

  return next.id; //  important
},
  duplicateItem: (itemId) =>
    set((state) => {
      const item = state.quotation.items.find((entry) => entry.id === itemId);
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
      const items = state.quotation.items.filter((item) => item.id !== itemId);
      return {
        quotation: {
          ...state.quotation,
          items: items.length ? items : state.quotation.items
        },
        selectedItemId: items[0]?.id ?? state.selectedItemId
      };
    }),
  selectItem: (itemId) => set({ selectedItemId: itemId }),
  setStatus: (status) =>
    set((state) => ({
      quotation: {
        ...state.quotation,
        status,
        history: [
          {
            id: crypto.randomUUID(),
            title: `Status changed to ${status}`,
            by: "Arjun Kapoor",
            at: new Date().toISOString(),
            description: `Quotation moved to ${status}`
          },
          ...state.quotation.history
        ]
      }
    })),
  setPricingMeta: (taxPercent, globalDiscount) => set({ taxPercent, globalDiscount }),
  markSaved: () => set({ lastSavedAt: new Date().toISOString() }),
  addRevision: (summary) =>
    set((state) => {
      const version = `v${state.quotation.revisions.length + 1}`;
      const totals = calculateQuotationTotals(state.quotation.items, state.taxPercent, state.globalDiscount);
      const revision = { ...createRevision(version, summary), snapshotTotals: totals };
      return {
        quotation: {
          ...state.quotation,
          status: "Revised",
          revisions: [revision, ...state.quotation.revisions],
          history: [
            {
              id: crypto.randomUUID(),
              title: "Revision created",
              by: "Arjun Kapoor",
              at: new Date().toISOString(),
              description: `${version} created`
            },
            ...state.quotation.history
          ]
        }
      };
    }),
  rollbackToRevision: (revisionId) =>
    set((state) => {
      const revision = state.quotation.revisions.find((entry) => entry.id === revisionId);
      if (!revision) return state;
      return {
        quotation: {
          ...state.quotation,
          status: "Revised",
          history: [
            {
              id: crypto.randomUUID(),
              title: "Rollback performed",
              by: "Arjun Kapoor",
              at: new Date().toISOString(),
              description: `Rolled back using ${revision.version}`
            },
            ...state.quotation.history
          ]
        }
      };
    })
}));
