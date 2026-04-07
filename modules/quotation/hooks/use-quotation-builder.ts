"use client";

import { useMemo } from "react";

import { calculateQuotationTotals } from "@/modules/quotation/utils/calculations";
import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";

export function useQuotationBuilder() {
  const {
    quotation,
    taxPercent,
    globalDiscount,
    lastSavedAt
  } = useQuotationBuilderStore();

  const totals = useMemo(
    () => calculateQuotationTotals(quotation.items, taxPercent, globalDiscount),
    [globalDiscount, quotation.items, taxPercent]
  );

  return {
    quotation,
    totals,
    taxPercent,
    globalDiscount,
    lastSavedAt,
    saveState: lastSavedAt ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}` : "Not saved yet"
  };
}
