"use client";

import { useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";

import { saveQuotationDraft } from "@/services/quotation-service";
import { useAutosave } from "@/hooks/use-autosave";
import { calculateQuotationTotals } from "@/modules/quotation/utils/calculations";
import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";

export function useQuotationBuilder() {
  const {
    quotation,
    taxPercent,
    globalDiscount,
    lastSavedAt,
    markSaved,
    setQuotation
  } = useQuotationBuilderStore();

  const totals = useMemo(
    () => calculateQuotationTotals(quotation.items, taxPercent, globalDiscount),
    [globalDiscount, quotation.items, taxPercent]
  );

  const mutation = useMutation({
    mutationFn: saveQuotationDraft,
    onSuccess: (data) => {
      setQuotation(data);
      markSaved();
    }
  });

  const autosave = useCallback(() => {
    mutation.mutate(quotation);
  }, [mutation, quotation]);

  useAutosave(autosave, true);

  return {
    quotation,
    totals,
    taxPercent,
    globalDiscount,
    lastSavedAt,
    saveState: mutation.isPending ? "Saving..." : lastSavedAt ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}` : "Not saved yet"
  };
}
