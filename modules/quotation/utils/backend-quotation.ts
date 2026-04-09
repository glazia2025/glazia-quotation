import type { Quotation } from "@/types/quotation";
import type { QuotationItem, QuotationSubItem } from "@/types/quotation";

export type BackendQuotationRecord = {
  _id?: string;
  generatedId?: string;
  createdAt?: string;
  customerDetails?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  quotationDetails?: {
    id?: string;
    quoteNo?: string;
    terms?: string;
    date?: string;
    opportunity?: string;
    notes?: string;
    status?: Quotation["status"];
    contactPhone?: string;
  };
  items?: Quotation["items"];
  history?: Quotation["history"];
  revisions?: Quotation["revisions"];
};

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

const LEGACY_MAX_INCH_DIMENSION = 300;
const MM_PER_INCH = 25.4;

function toMmDimension(value: unknown): number {
  const numeric = Number(value) || 0;
  if (numeric <= 0) return 0;
  return numeric <= LEGACY_MAX_INCH_DIMENSION ? Math.round(numeric * MM_PER_INCH) : numeric;
}

function normalizeSubItemDimensions(item: QuotationSubItem): QuotationSubItem {
  return {
    ...item,
    width: toMmDimension(item.width),
    height: toMmDimension(item.height)
  };
}

function normalizeItemDimensions(item: QuotationItem): QuotationItem {
  return {
    ...item,
    width: toMmDimension(item.width),
    height: toMmDimension(item.height),
    subItems: item.subItems?.map(normalizeSubItemDimensions) ?? []
  };
}

export function toEditorQuotation(record: BackendQuotationRecord): Quotation {
  const customer = record.customerDetails;
  const details = record.quotationDetails;

  return {
    id: details?.id ?? record._id ?? crypto.randomUUID(),
    quoteNo: record.generatedId ?? details?.quoteNo ?? details?.id ?? record._id ?? "",
    persisted: true,
    status: details?.status ?? "Draft",
    customer: {
      customerName: customer?.name ?? customer?.company ?? "",
      contactPerson: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      projectName: details?.opportunity ?? "",
      siteAddress: customer?.address ?? "",
      city: customer?.city ?? "",
      state: customer?.state ?? "",
      pincode: customer?.pincode ?? ""
    },
    items: (record.items ?? []).map(normalizeItemDimensions),
    terms: details?.terms ?? "",
    internalNotes: details?.notes ?? "",
    attachments: [],
    history: record.history ?? [],
    revisions: record.revisions ?? [],
    date: details?.date,
    opportunity: details?.opportunity,
    contactPhone: details?.contactPhone
  };
}
