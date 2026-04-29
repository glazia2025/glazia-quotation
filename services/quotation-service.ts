import axios from "axios";

import { extractBackendQuotation, type BackendQuotationRecord } from "@/modules/quotation/utils/backend-quotation";
import { API_BASE_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth-store";
import type { Quotation, QuotationSubItem } from "@/types/quotation";
import { getAuthToken } from "@/utils/auth-cookie";

function getAuthHeaders() {
  const token = useAuthStore.getState().token ?? getAuthToken();

  if (!token) {
    throw new Error("Authentication token missing.");
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

type ApiQuotationListResponse = {
  quotations?: unknown;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  data?: unknown;
};

export type QuotationsPage = {
  quotations: BackendQuotationRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function findQuotationEnvelope(payload: unknown): Record<string, unknown> | null {
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);

    const source = current as Record<string, unknown>;
    const hasId = typeof source._id === "string";
    const hasGeneratedId = typeof source.generatedId === "string";
    const hasQuotationDetails = typeof source.quotationDetails === "object" && source.quotationDetails !== null;

    if (hasId || hasGeneratedId || hasQuotationDetails) {
      return source;
    }

    queue.push(source.quotation, source.data, source.result, source.record);
  }

  return null;
}

function toBackendSubItem(subItem: QuotationSubItem) {
  return {
    refCode: subItem.refCode || "",
    location: subItem.location || "",
    width: Number(subItem.width) || 0,
    height: Number(subItem.height) || 0,
    area: Number(subItem.area) || 0,
    systemType: subItem.systemType || "",
    series: subItem.series || "",
    description: subItem.description || "",
    colorFinish: subItem.colorFinish || "",
    glassSpec: subItem.glassSpec || "",
    handleType: subItem.handleType || "",
    handleColor: subItem.handleColor || "",
    handleCount: Number(subItem.handleCount) || 0,
    meshPresent: Boolean(subItem.meshPresent),
    meshType: subItem.meshType || "",
    rate: Number(subItem.rate) || 0,
    quantity: Math.max(1, Number(subItem.quantity) || 1),
    amount: Number(subItem.amount) || 0,
    refImage: subItem.refImage || "",
    remarks: subItem.remarks || "",
  };
}

function toBackendItem(item: Quotation["items"][number]) {
  return {
    refCode: item.refCode || "",
    location: item.location || item.projectLocation || "",
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    area: Number(item.area) || 0,
    systemType: item.systemType || "",
    series: item.series || "",
    description: item.description || "",
    colorFinish: item.colorFinish || "",
    glassSpec: item.glassSpec || "",
    handleType: item.handleType || "",
    handleColor: item.handleColor || "",
    handleCount: Number(item.handleCount) || 0,
    meshPresent: Boolean(item.meshPresent),
    meshType: item.meshType || "",
    rate: Number(item.rate) || 0,
    quantity: Math.max(1, Number(item.quantity) || 1),
    amount: Number(item.amount) || 0,
    refImage: item.refImage || "",
    remarks: item.remarks || item.specialNotes || "",
    subItems: Array.isArray(item.subItems) ? item.subItems.map(toBackendSubItem) : [],
    configuratorLayout: item.configuratorLayout || undefined,
  };
}

function toBackendQuotation(quotation: Quotation) {
  return {
    user: quotation.user,
    items: Array.isArray(quotation.items) ? quotation.items.map(toBackendItem) : [],
    customerDetails: {
      name: quotation.customerDetails?.name || "",
      company: quotation.customerDetails?.company || "",
      email: quotation.customerDetails?.email || "",
      phone: quotation.customerDetails?.phone || "",
      address: quotation.customerDetails?.address || "",
      city: quotation.customerDetails?.city || "",
      state: quotation.customerDetails?.state || "",
      pincode: quotation.customerDetails?.pincode || "",
    },
    quotationDetails: {
      id: quotation.quotationDetails?.id || "",
      date: quotation.quotationDetails?.date || "",
      opportunity: quotation.quotationDetails?.opportunity || "",
      terms: quotation.quotationDetails?.terms || "",
      notes: quotation.quotationDetails?.notes || "",
    },
    breakdown: {
      totalAmount: Number(quotation.breakdown?.totalAmount) || 0,
      profitPercentage: Number(quotation.breakdown?.profitPercentage) || 0,
    },
    globalConfig: {
      logo: quotation.globalConfig?.logo || "",
      terms: quotation.globalConfig?.terms || "",
      prerequisites: quotation.globalConfig?.prerequisites || "",
      additionalCosts: {
        installation: Number(quotation.globalConfig?.additionalCosts?.installation) || 0,
        transport: Number(quotation.globalConfig?.additionalCosts?.transport) || 0,
        loadingUnloading: Number(quotation.globalConfig?.additionalCosts?.loadingUnloading) || 0,
        discountPercent: Number(quotation.globalConfig?.additionalCosts?.discountPercent) || 0,
      },
    },
    generatedId: quotation.generatedId || undefined,
  };
}

function toQuotationList(payload: unknown): BackendQuotationRecord[] {
  const source =
    typeof payload === "object" && payload !== null
      ? ((payload as { quotations?: unknown }).quotations ??
        (payload as { data?: unknown }).data ??
        payload)
      : payload;

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((entry) => extractBackendQuotation(entry))
    .filter((entry): entry is BackendQuotationRecord => Boolean(entry));
}

function toQuotationsPage(payload: unknown): QuotationsPage {
  const source =
    typeof payload === "object" && payload !== null ? (payload as ApiQuotationListResponse) : {};

  return {
    quotations: toQuotationList(source),
    page: source.page ?? 1,
    limit: source.limit ?? 20,
    total: source.total ?? 0,
    totalPages: source.totalPages ?? 1
  };
}

export async function getQuotations(page = 1, limit = 20): Promise<QuotationsPage> {
  const response = await axios.get(`${API_BASE_URL}/api/quotations`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    params: { page, limit }
  });

  const mapped = toQuotationsPage(response.data);
  console.log("[quotation-service] getQuotations raw response", response.data);
  console.log("[quotation-service] getQuotations mapped page", mapped);

  return mapped;
}

export async function getQuotation(quotationId: string): Promise<BackendQuotationRecord | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}`, {
      headers: getAuthHeaders(),
      withCredentials: true,
    });

    console.log("[quotation-service] getQuotation raw response", quotationId, response.data);
    return extractBackendQuotation(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getQuotationPdfBlob(quotationId: string): Promise<Blob> {
  const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}/pdf`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    responseType: "blob"
  });

  return response.data;
}

export async function getCuttingSchedulePdfBlob(quotationId: string): Promise<Blob> {
  const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}/cutting-schedule`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    responseType: "blob"
  });

  return response.data;
}

export async function saveQuotationDraft(quotation: Quotation): Promise<BackendQuotationRecord | null> {
  const headers = getAuthHeaders();
  const payload = toBackendQuotation(quotation);

  const response = quotation._id
    ? await axios.post(`${API_BASE_URL}/api/quotations/${quotation._id}`, payload, { headers })
    : await axios.post(`${API_BASE_URL}/api/quotations`, payload, { headers });

  const extracted = extractBackendQuotation(response.data);
  if (extracted) {
    return extracted;
  }

  const envelope = findQuotationEnvelope(response.data);
  const resolvedId =
    quotation._id ||
    (typeof envelope?._id === "string" ? envelope._id : undefined);
  const resolvedGeneratedId =
    quotation.generatedId ||
    (typeof envelope?.generatedId === "string" ? envelope.generatedId : undefined);
  const resolvedQuotationDetails =
    typeof envelope?.quotationDetails === "object" && envelope.quotationDetails !== null
      ? {
          ...quotation.quotationDetails,
          ...(envelope.quotationDetails as Record<string, unknown>),
        }
      : quotation.quotationDetails;

  if (resolvedId || resolvedGeneratedId) {
    return {
      ...quotation,
      _id: resolvedId,
      generatedId: resolvedGeneratedId,
      quotationDetails: {
        id: typeof resolvedQuotationDetails.id === "string" ? resolvedQuotationDetails.id : quotation.quotationDetails.id,
        date: typeof resolvedQuotationDetails.date === "string" ? resolvedQuotationDetails.date : quotation.quotationDetails.date,
        opportunity:
          typeof resolvedQuotationDetails.opportunity === "string"
            ? resolvedQuotationDetails.opportunity
            : quotation.quotationDetails.opportunity,
        terms: typeof resolvedQuotationDetails.terms === "string" ? resolvedQuotationDetails.terms : quotation.quotationDetails.terms,
        notes: typeof resolvedQuotationDetails.notes === "string" ? resolvedQuotationDetails.notes : quotation.quotationDetails.notes,
      },
    };
  }

  if (quotation._id) {
    return {
      ...quotation,
      _id: quotation._id,
    };
  }

  return null;
}

export async function deleteQuotation(quotationId: string) {
  await axios.delete(`${API_BASE_URL}/api/quotations/${quotationId}`, {
    headers: getAuthHeaders()
  });
}
