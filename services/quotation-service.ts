import axios from "axios";

import { API_BASE_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth-store";
import type { Quotation, QuotationSubItem } from "@/types/quotation";
import { getAuthToken } from "@/utils/auth-cookie";

export type BackendQuotationRecord = Quotation;

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

const normalizeCutAngle = (value: unknown, fallback: "45" | "90" = "90"): "45" | "90" =>
  value === "45" || value === 45 ? "45" : value === "90" || value === 90 ? "90" : fallback;

const makeCuttingScheduleKey = (horizontalAngle: "45" | "90", verticalAngle: "45" | "90") =>
  `${horizontalAngle}_${verticalAngle}`;

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

    queue.push(source.quotation, source.updatedQuotation, source.data, source.result, source.record);
  }

  return null;
}

function toBackendSubItem(subItem: QuotationSubItem) {
  const handleType = subItem.handleType || "";
  const horizontalCutAngle = normalizeCutAngle(subItem.horizontalCutAngle);
  const verticalCutAngle = normalizeCutAngle(subItem.verticalCutAngle);

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
    handleType,
    handleColor: handleType ? subItem.handleColor || "" : "",
    handleCount: Number(subItem.handleCount) || 0,
    meshPresent: Boolean(subItem.meshPresent),
    meshType: subItem.meshType || "",
    rate: Number(subItem.rate) || 0,
    quantity: Math.max(1, Number(subItem.quantity) || 1),
    amount: Number(subItem.amount) || 0,
    refImage: subItem.refImage || "",
    remarks: subItem.remarks || "",
    horizontalCutAngle,
    verticalCutAngle,
    cuttingScheduleKey: makeCuttingScheduleKey(horizontalCutAngle, verticalCutAngle),
    sash: subItem.sash,
    panelSashes: subItem.panelSashes,
    hasExhaustFan: Boolean(subItem.hasExhaustFan),
    exhaustFanX: typeof subItem.exhaustFanX === "number" ? subItem.exhaustFanX : undefined,
    exhaustFanY: typeof subItem.exhaustFanY === "number" ? subItem.exhaustFanY : undefined,
    exhaustFanSize: typeof subItem.exhaustFanSize === "number" ? subItem.exhaustFanSize : undefined,
    baseRate: Number(subItem.baseRate) || 0,
    areaSlabIndex: Number(subItem.areaSlabIndex) || 0,
  };
}

function toBackendItem(item: Quotation["items"][number]) {
  const handleType = item.handleType || "";
  const horizontalCutAngle = normalizeCutAngle(item.horizontalCutAngle);
  const verticalCutAngle = normalizeCutAngle(item.verticalCutAngle);

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
    handleType,
    handleColor: handleType ? item.handleColor || "" : "",
    handleCount: Number(item.handleCount) || 0,
    meshPresent: Boolean(item.meshPresent),
    meshType: item.meshType || "",
    rate: Number(item.rate) || 0,
    quantity: Math.max(1, Number(item.quantity) || 1),
    amount: Number(item.amount) || 0,
    refImage: item.refImage || "",
    remarks: item.remarks || item.specialNotes || "",
    horizontalCutAngle,
    verticalCutAngle,
    cuttingScheduleKey: makeCuttingScheduleKey(horizontalCutAngle, verticalCutAngle),
    sash: item.sash,
    panelSashes: item.panelSashes,
    hasExhaustFan: Boolean(item.hasExhaustFan),
    exhaustFanX: typeof item.exhaustFanX === "number" ? item.exhaustFanX : undefined,
    exhaustFanY: typeof item.exhaustFanY === "number" ? item.exhaustFanY : undefined,
    exhaustFanSize: typeof item.exhaustFanSize === "number" ? item.exhaustFanSize : undefined,
    baseRate: Number(item.baseRate) || 0,
    areaSlabIndex: Number(item.areaSlabIndex) || 0,
    subItems: Array.isArray(item.subItems) ? item.subItems.map(toBackendSubItem) : [],
    configuratorLayout: item.configuratorLayout || undefined,
  };
}

function toBackendQuotation(quotation: Quotation) {
  const itemTotal = Array.isArray(quotation.items)
    ? quotation.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : 0;
  const profitPercentage = Number(quotation.breakdown?.profitPercentage) || 0;
  const computedTotalAmount = itemTotal + (itemTotal * profitPercentage) / 100;

  return {
    user: quotation.user,
    items: Array.isArray(quotation.items) ? quotation.items.map(toBackendItem) : [],
    customerDetails: {
      name: quotation.customerDetails?.name || "",
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
      totalAmount: Number(quotation.breakdown?.totalAmount) || computedTotalAmount,
      profitPercentage,
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
        showInstallation: quotation.globalConfig?.additionalCosts?.showInstallation ?? true,
        showTransport: quotation.globalConfig?.additionalCosts?.showTransport ?? true,
        showLoadingUnloading: quotation.globalConfig?.additionalCosts?.showLoadingUnloading ?? true,
        showDiscount: quotation.globalConfig?.additionalCosts?.showDiscount ?? true,
      },
    },
    generatedId: quotation.generatedId || undefined,
  };
}

function unwrapQuotationList(payload: unknown): BackendQuotationRecord[] {
  const source = typeof payload === "object" && payload !== null ? (payload as ApiQuotationListResponse) : {};
  const quotations = source.quotations ?? source.data ?? payload;

  return Array.isArray(quotations) ? (quotations as BackendQuotationRecord[]) : [];
}

function toQuotationsPage(payload: unknown): QuotationsPage {
  const source =
    typeof payload === "object" && payload !== null ? (payload as ApiQuotationListResponse) : {};

  return {
    quotations: unwrapQuotationList(source),
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

  return toQuotationsPage(response.data);
}

export async function getQuotation(quotationId: string): Promise<BackendQuotationRecord | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}`, {
      headers: getAuthHeaders(),
      withCredentials: true,
    });

    const source = response.data;
    if (source && typeof source === "object" && "quotation" in source) {
      return (source as { quotation?: BackendQuotationRecord }).quotation ?? null;
    }

    return source as BackendQuotationRecord;
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

  const envelope = findQuotationEnvelope(response.data);
  return envelope ? (envelope as unknown as BackendQuotationRecord) : null;
}

export async function deleteQuotation(quotationId: string) {
  await axios.delete(`${API_BASE_URL}/api/quotations/${quotationId}`, {
    headers: getAuthHeaders(),
    withCredentials: true,
  });
}
