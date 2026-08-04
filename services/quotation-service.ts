import axios from "axios";

import { QUOTATION_API_BASE_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth-store";
import type { Quotation, QuotationSubItem } from "@/types/quotation";
import { getAuthToken } from "@/utils/auth-cookie";
import { extractBackendQuotation, extractBackendQuotationItem } from "@/modules/quotation/utils/backend-quotation";

export type BackendQuotationRecord = Quotation;

export type RateCalculationItem = {
  clientId: string;
  systemType: string;
  series: string;
  description: string;
  width: number;
  height: number;
  area: number;
  frameCutAngle: "45" | "90";
  shutterCutAngle: "45" | "90";
  cuttingScheduleKey: string;
  glassSpec?: string;
  hardwareOpeningType?: "hinges" | "frictionStay" | "";
  itemType?: "join";
  joinType?: "Mullion" | "Coupler";
  joinOrientation?: "vertical" | "horizontal";
};

export type RateCalculationResult = {
  clientId: string;
  baseRate: number;
  materialValue: number;
  area: number;
  totalWeightKg: number;
  nalcoPrice: number;
  nalcoRatePerKg: number;
  calculatedAt: string;
  calculationVersion: number;
  warnings: string[];
};

function getAuthHeaders() {
  const token = useAuthStore.getState().token ?? getAuthToken();

  if (!token) {
    throw new Error("Authentication token missing.");
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

export async function calculateQuotationRates(items: RateCalculationItem[]) {
  const response = await axios.post<{ items: RateCalculationResult[] }>(
    `${QUOTATION_API_BASE_URL}/api/quotations/calculate-rate`,
    { items },
    { headers: getAuthHeaders(), withCredentials: true }
  );
  return response.data.items;
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
  const frameCutAngle = normalizeCutAngle(subItem.frameCutAngle);
  const shutterCutAngle = normalizeCutAngle(subItem.shutterCutAngle);

  return {
      id: subItem.id,  
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
    hardwareOpeningType: subItem.hardwareOpeningType || "",
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
    frameCutAngle,
    shutterCutAngle,
    cuttingScheduleKey: makeCuttingScheduleKey(frameCutAngle, shutterCutAngle),
    sash: subItem.sash,
    panelSashes: subItem.panelSashes,
    hasExhaustFan: Boolean(subItem.hasExhaustFan),
    exhaustFanX: typeof subItem.exhaustFanX === "number" ? subItem.exhaustFanX : undefined,
    exhaustFanY: typeof subItem.exhaustFanY === "number" ? subItem.exhaustFanY : undefined,
    exhaustFanSize: typeof subItem.exhaustFanSize === "number" ? subItem.exhaustFanSize : undefined,
    archType: subItem.archType && subItem.archType !== "none" ? subItem.archType : "none",
    archHeightRatio: typeof subItem.archHeightRatio === "number" ? subItem.archHeightRatio : undefined,
    baseRate: Number(subItem.baseRate) || 0,
    areaSlabIndex: Number(subItem.areaSlabIndex) || 0,
    rateSource: subItem.rateSource || "legacy",
    calculatedBaseRate: subItem.calculatedBaseRate,
    calculatedFinalRate: subItem.calculatedFinalRate,
    nalcoPriceUsed: subItem.nalcoPriceUsed,
    nalcoRatePerKg: subItem.nalcoRatePerKg,
    profileWeightKg: subItem.profileWeightKg,
    profileMaterialValue: subItem.profileMaterialValue,
    rateCalculatedAt: subItem.rateCalculatedAt,
    rateCalculationVersion: subItem.rateCalculationVersion,
  };
}

export function toBackendItem(item: Quotation["items"][number]) {
   console.log("ITEM SUBITEMS BEFORE BACKEND");
  console.dir(item.subItems, { depth: null });
  const handleType = item.handleType || "";
  const frameCutAngle = normalizeCutAngle(item.frameCutAngle);
  const shutterCutAngle = normalizeCutAngle(item.shutterCutAngle);

  return {
      id: item.id,  
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
    hardwareOpeningType: item.hardwareOpeningType || "",
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
    frameCutAngle,
    shutterCutAngle,
    cuttingScheduleKey: makeCuttingScheduleKey(frameCutAngle, shutterCutAngle),
    sash: item.sash,
    panelSashes: item.panelSashes,
    hasExhaustFan: Boolean(item.hasExhaustFan),
    exhaustFanX: typeof item.exhaustFanX === "number" ? item.exhaustFanX : undefined,
    exhaustFanY: typeof item.exhaustFanY === "number" ? item.exhaustFanY : undefined,
    exhaustFanSize: typeof item.exhaustFanSize === "number" ? item.exhaustFanSize : undefined,
    archType: item.archType && item.archType !== "none" ? item.archType : "none",
    archHeightRatio: typeof item.archHeightRatio === "number" ? item.archHeightRatio : undefined,
    baseRate: Number(item.baseRate) || 0,
    areaSlabIndex: Number(item.areaSlabIndex) || 0,
    rateSource: item.rateSource || "legacy",
    calculatedBaseRate: item.calculatedBaseRate,
    calculatedFinalRate: item.calculatedFinalRate,
    nalcoPriceUsed: item.nalcoPriceUsed,
    nalcoRatePerKg: item.nalcoRatePerKg,
    profileWeightKg: item.profileWeightKg,
    profileMaterialValue: item.profileMaterialValue,
    rateCalculatedAt: item.rateCalculatedAt,
    rateCalculationVersion: item.rateCalculationVersion,
    subItems: Array.isArray(item.subItems) ? item.subItems.map(toBackendSubItem) : [],
    joins: Array.isArray(item.joins)
  ? item.joins.map((join) => ({
      p1: join.p1,
      p2: join.p2,
      type: join.type,
    }))
  : [],
    configuratorLayout: item.configuratorLayout || undefined,
  };
}

export function toBackendQuotation(quotation: Quotation) {
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
      website: quotation.globalConfig?.website || "",
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

export const getQuotationSaveFingerprint = (quotation: Quotation) =>
  JSON.stringify(toBackendQuotation(quotation));

export const getQuotationItemsSaveFingerprint = (quotation: Quotation) =>
  JSON.stringify(toBackendQuotation(quotation).items);

export const getQuotationMetadataSaveFingerprint = (quotation: Quotation) => {
  const { items: _items, ...metadata } = toBackendQuotation(quotation);
  return JSON.stringify(metadata);
};

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
  const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    params: { page, limit }
  });

  return toQuotationsPage(response.data);
}

export async function getQuotation(quotationId: string): Promise<BackendQuotationRecord | null> {
  try {
    const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}`, {
      headers: getAuthHeaders(),
      withCredentials: true,
    });

    return extractBackendQuotation(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getQuotationPdfBlob(quotationId: string): Promise<Blob> {
  const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/pdf`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    responseType: "blob"
  });

  return response.data;
}
export async function getElevationPdfBlob(quotationId: string): Promise<Blob> {
  const response = await axios.get(
    `${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/elevation-pdf`,
    {
      headers: getAuthHeaders(),
      withCredentials: true,
      responseType: "blob"
    }
  );

  return response.data;
}

export async function getCuttingSchedulePdfBlob(quotationId: string): Promise<Blob> {
  const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/cutting-schedule`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    responseType: "blob"
  });

  return response.data;
}

export async function getBomPdfBlob(quotationId: string): Promise<Blob> {
  const response = await axios.get(`${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/bom`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    responseType: "blob"
  });

  return response.data;
}

export type BomOrderRow = {
  type: string;
  system: string;
  series: string;
  description: string;
  itemCode: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
};

export type BomOrderData = {
  project: string;
  projectCode: string;
  customer: {
    name?: string;
    city?: string;
    phone?: string;
  };
  rows: BomOrderRow[];
  totals: Record<string, number> & { grand: number };
  notes: string[];
};

export async function getBomOrderData(quotationId: string): Promise<BomOrderData> {
  const response = await axios.get<BomOrderData>(
    `${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/bom-data`,
    {
      headers: getAuthHeaders(),
      withCredentials: true,
    }
  );

  return response.data;
}

export async function getOptimizedFinal(quotationId: string) {
  const response = await axios.get<{
    optimizedFinal: number;
    nalcoPrice: number;
    calculatedAt: string;
  }>(`${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/optimized-final`, {
    headers: getAuthHeaders(),
    withCredentials: true,
  });
  return response.data;
}

export async function saveQuotationDraft(quotation: Quotation): Promise<BackendQuotationRecord | null> {
  const headers = getAuthHeaders();
  const payload = toBackendQuotation(quotation);

  const response = quotation._id
    ? await axios.post(`${QUOTATION_API_BASE_URL}/api/quotations/${quotation._id}`, payload, { headers })
    : await axios.post(`${QUOTATION_API_BASE_URL}/api/quotations`, payload, { headers });

  const envelope = findQuotationEnvelope(response.data);
  return envelope ? extractBackendQuotation(envelope) : null;
}

export async function saveQuotationMetadata(quotation: Quotation): Promise<BackendQuotationRecord | null> {
  const headers = getAuthHeaders();
  const { items: _items, ...payload } = toBackendQuotation(quotation);
  const response = quotation._id
    ? await axios.post(`${QUOTATION_API_BASE_URL}/api/quotations/${quotation._id}`, payload, { headers })
    : await axios.post(`${QUOTATION_API_BASE_URL}/api/quotations`, payload, { headers });
  const envelope = findQuotationEnvelope(response.data);
  return envelope ? extractBackendQuotation(envelope) : null;
}

const extractItemResponse = (payload: unknown) => {
  if (!payload || typeof payload !== "object") throw new Error("Quotation item API returned no item");
  const item = (payload as { item?: unknown }).item;
  if (!item) throw new Error("Quotation item API returned no item");
  return extractBackendQuotationItem(item);
};

export async function createQuotationItem(quotationId: string, item: Quotation["items"][number]) {
  const response = await axios.post(
    `${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/items`,
    { item: toBackendItem(item) },
    { headers: getAuthHeaders() }
  );
  return extractItemResponse(response.data);
}

export async function updateQuotationItem(
  quotationId: string,
  itemId: string,
  item: Quotation["items"][number]
) {
  const response = await axios.patch(
    `${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/items/${itemId}`,
    { item: toBackendItem(item) },
    { headers: getAuthHeaders() }
  );
  return extractItemResponse(response.data);
}

export async function deleteQuotationItem(quotationId: string, itemId: string) {
  await axios.delete(`${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/items/${itemId}`, {
    headers: getAuthHeaders(),
  });
}

export async function reorderQuotationItems(quotationId: string, itemIds: string[]) {
  await axios.patch(
    `${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/items/reorder`,
    { itemIds },
    { headers: getAuthHeaders() }
  );
}

export async function bulkUpdateQuotationItems(
  quotationId: string,
  field: "glass" | "colorFinish",
  from: string,
  to: string
) {
  const response = await axios.patch(
    `${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}/items/bulk-update`,
    { field, from, to },
    { headers: getAuthHeaders() }
  );
  const quotation = extractBackendQuotation(response.data?.quotation);
  if (!quotation) {
    throw new Error("Bulk update returned an invalid quotation");
  }
  return {
    quotation,
    updatedCount: Number(response.data?.updatedCount) || 0,
  };
}

export async function deleteQuotation(quotationId: string) {
  await axios.delete(`${QUOTATION_API_BASE_URL}/api/quotations/${quotationId}`, {
    headers: getAuthHeaders(),
    withCredentials: true,
  });
}
