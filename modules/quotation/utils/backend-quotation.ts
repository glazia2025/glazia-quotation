import type { Quotation } from "@/types/quotation";

export type BackendQuotationRecord = Quotation;

function isQuotationRecord(value: unknown): value is BackendQuotationRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BackendQuotationRecord>;
  return Array.isArray(candidate.items) && typeof candidate.quotationDetails === "object" && candidate.quotationDetails !== null;
}

export function extractBackendQuotation(payload: unknown): BackendQuotationRecord | null {
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (isQuotationRecord(current)) {
      return current;
    }

    const source = current as {
      quotation?: unknown;
      data?: unknown;
      result?: unknown;
      record?: unknown;
    };

    queue.push(source.quotation, source.data, source.result, source.record);
  }

  return null;
}
