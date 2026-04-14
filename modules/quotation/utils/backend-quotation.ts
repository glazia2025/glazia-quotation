import type { Quotation } from "@/types/quotation";

export type BackendQuotationRecord = Quotation;

export function extractBackendQuotation(payload: unknown): BackendQuotationRecord | null {
  const source =
    typeof payload === "object" && payload !== null
      ? ((payload as { quotation?: unknown }).quotation ??
        (payload as { data?: unknown }).data ??
        payload)
      : null;

  if (!source || typeof source !== "object") {
    return null;
  }

  return source as BackendQuotationRecord;
}
