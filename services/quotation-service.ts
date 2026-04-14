import axios from "axios";

import { extractBackendQuotation, type BackendQuotationRecord } from "@/modules/quotation/utils/backend-quotation";
import { API_BASE_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth-store";
import type { Quotation } from "@/types/quotation";

function getAuthHeaders() {
  const token = useAuthStore.getState().token ?? (typeof window !== "undefined" ? localStorage.getItem("authToken") : null);

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

  return source.filter((entry): entry is BackendQuotationRecord => Boolean(extractBackendQuotation(entry)));
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
    params: { page, limit }
  });

  const mapped = response.data;
  console.log("[quotation-service] getQuotations raw response", response.data);
  console.log("[quotation-service] getQuotations mapped page", mapped);

  return mapped;
}

export async function getQuotation(quotationId: string): Promise<BackendQuotationRecord | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}`, {
      headers: getAuthHeaders()
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
    responseType: "blob"
  });

  return response.data;
}

export async function saveQuotationDraft(quotation: Quotation): Promise<BackendQuotationRecord | null> {
  const headers = getAuthHeaders();
  const payload = quotation;

  const response = quotation._id
    ? await axios.post(`${API_BASE_URL}/api/quotations/${quotation._id}`, payload, { headers })
    : await axios.post(`${API_BASE_URL}/api/quotations`, payload, { headers });

  return extractBackendQuotation(response.data);
}

export async function deleteQuotation(quotationId: string) {
  await axios.delete(`${API_BASE_URL}/api/quotations/${quotationId}`, {
    headers: getAuthHeaders()
  });
}
