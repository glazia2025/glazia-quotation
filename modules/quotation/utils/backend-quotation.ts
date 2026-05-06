import type { Quotation, QuotationItem, QuotationSubItem } from "@/types/quotation";

export type BackendQuotationRecord = Quotation;

const createClientId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
};

const toStringValue = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return fallback;
};
const toNumberValue = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};
const toBooleanValue = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const toCutAngleValue = (value: unknown, fallback: "45" | "90" = "90"): "45" | "90" =>
  value === "45" || value === 45 ? "45" : value === "90" || value === 90 ? "90" : fallback;
const toCuttingScheduleKey = (horizontalAngle: "45" | "90", verticalAngle: "45" | "90") =>
  `${horizontalAngle}_${verticalAngle}` as "45_45" | "45_90" | "90_45" | "90_90";

const normalizeSubItem = (value: unknown): QuotationSubItem => {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const horizontalCutAngle = toCutAngleValue(source.horizontalCutAngle);
  const verticalCutAngle = toCutAngleValue(source.verticalCutAngle);

  return {
    id: toStringValue(source.id) || toStringValue(source._id) || toStringValue(source.refCode) || createClientId(),
    refCode: toStringValue(source.refCode),
    location: toStringValue(source.location),
    width: toNumberValue(source.width),
    height: toNumberValue(source.height),
    area: toNumberValue(source.area),
    systemType: toStringValue(source.systemType),
    series: toStringValue(source.series),
    description: toStringValue(source.description),
    colorFinish: toStringValue(source.colorFinish),
    glassSpec: toStringValue(source.glassSpec),
    handleType: toStringValue(source.handleType),
    handleColor: toStringValue(source.handleColor),
    handleCount: toNumberValue(source.handleCount),
    meshPresent: toBooleanValue(source.meshPresent),
    meshType: toStringValue(source.meshType),
    rate: toNumberValue(source.rate),
    quantity: toNumberValue(source.quantity, 1),
    amount: toNumberValue(source.amount),
    refImage: toStringValue(source.refImage),
    remarks: toStringValue(source.remarks),
    horizontalCutAngle,
    verticalCutAngle,
    cuttingScheduleKey: toCuttingScheduleKey(horizontalCutAngle, verticalCutAngle),
  };
};

const normalizeItem = (value: unknown): QuotationItem => {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const location = toStringValue(source.location);
  const width = toNumberValue(source.width);
  const height = toNumberValue(source.height);
  const glassSpec = toStringValue(source.glassSpec);
  const remarks = toStringValue(source.remarks);
  const horizontalCutAngle = toCutAngleValue(source.horizontalCutAngle);
  const verticalCutAngle = toCutAngleValue(source.verticalCutAngle);

  return {
    id: toStringValue(source.id) || toStringValue(source._id) || toStringValue(source.refCode) || createClientId(),
    refCode: toStringValue(source.refCode),
    location,
    projectLocation: location,
    width,
    height,
    area: toNumberValue(source.area),
    productType: height > 2200 ? "Door" : "Window",
    systemType: toStringValue(source.systemType),
    material: "",
    series: toStringValue(source.series),
    description: toStringValue(source.description),
    designType: "",
    openingType: "",
    quantity: toNumberValue(source.quantity, 1),
    amount: toNumberValue(source.amount),
    glassType: glassSpec ? "Yes" : "",
    glassSpec,
    accessories: [],
    colorFinish: toStringValue(source.colorFinish),
    specialNotes: remarks,
    handleType: toStringValue(source.handleType),
    handleColor: toStringValue(source.handleColor),
    handleCount: toNumberValue(source.handleCount),
    meshPresent: toBooleanValue(source.meshPresent),
    meshType: toStringValue(source.meshType),
    rate: toNumberValue(source.rate),
    refImage: toStringValue(source.refImage),
    remarks,
    horizontalCutAngle,
    verticalCutAngle,
    cuttingScheduleKey: toCuttingScheduleKey(horizontalCutAngle, verticalCutAngle),
    subItems: Array.isArray(source.subItems) ? source.subItems.map(normalizeSubItem) : [],
    configuratorLayout:
      typeof source.configuratorLayout === "object" && source.configuratorLayout !== null
        ? (source.configuratorLayout as Record<string, unknown>)
        : undefined,
    laborRate: 0,
    transportRate: 0,
    discountPercent: 0,
    previewPanels: 1,
  };
};

function isQuotationRecord(value: unknown): value is BackendQuotationRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BackendQuotationRecord> & { generatedId?: unknown; _id?: unknown };
  const hasQuotationDetails = typeof candidate.quotationDetails === "object" && candidate.quotationDetails !== null;
  const hasItems = Array.isArray(candidate.items);
  const hasStableIdentity =
    typeof candidate._id === "string" ||
    typeof candidate.generatedId === "string" ||
    (typeof candidate.quotationDetails === "object" &&
      candidate.quotationDetails !== null &&
      typeof (candidate.quotationDetails as unknown as Record<string, unknown>).id === "string");

  return hasQuotationDetails && (hasItems || hasStableIdentity);
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
      const source = current as unknown as Record<string, unknown>;
      return {
        _id: toStringValue(source._id) || undefined,
        user: toStringValue(source.user) || undefined,
        items: Array.isArray(source.items) ? source.items.map(normalizeItem) : [],
        customerDetails:
          typeof source.customerDetails === "object" && source.customerDetails !== null
            ? {
                name: toStringValue((source.customerDetails as Record<string, unknown>).name),
                phone: toStringValue((source.customerDetails as Record<string, unknown>).phone),
                email: toStringValue((source.customerDetails as Record<string, unknown>).email),
                address: toStringValue((source.customerDetails as Record<string, unknown>).address),
                city: toStringValue((source.customerDetails as Record<string, unknown>).city),
                state: toStringValue((source.customerDetails as Record<string, unknown>).state),
                pincode: toStringValue((source.customerDetails as Record<string, unknown>).pincode),
              }
            : {
                name: "",
                phone: "",
                email: "",
                address: "",
                city: "",
                state: "",
                pincode: "",
              },
        quotationDetails:
          typeof source.quotationDetails === "object" && source.quotationDetails !== null
            ? {
                id: toStringValue((source.quotationDetails as Record<string, unknown>).id),
                date: toStringValue((source.quotationDetails as Record<string, unknown>).date),
                opportunity: toStringValue((source.quotationDetails as Record<string, unknown>).opportunity),
                terms: toStringValue((source.quotationDetails as Record<string, unknown>).terms),
                notes: toStringValue((source.quotationDetails as Record<string, unknown>).notes),
              }
            : {
                id: "",
                date: "",
                opportunity: "",
                terms: "",
                notes: "",
              },
        breakdown:
          typeof source.breakdown === "object" && source.breakdown !== null
            ? {
                totalAmount: toNumberValue((source.breakdown as Record<string, unknown>).totalAmount),
                profitPercentage: toNumberValue((source.breakdown as Record<string, unknown>).profitPercentage),
              }
            : typeof source.totalAmount !== "undefined"
              ? {
                  totalAmount: toNumberValue(source.totalAmount),
                  profitPercentage: 0,
                }
              : undefined,
        globalConfig:
          typeof source.globalConfig === "object" && source.globalConfig !== null
            ? {
                logo: toStringValue((source.globalConfig as Record<string, unknown>).logo) || undefined,
                terms: toStringValue((source.globalConfig as Record<string, unknown>).terms) || undefined,
                prerequisites: toStringValue((source.globalConfig as Record<string, unknown>).prerequisites) || undefined,
                additionalCosts:
                  typeof (source.globalConfig as Record<string, unknown>).additionalCosts === "object" &&
                  (source.globalConfig as Record<string, unknown>).additionalCosts !== null
                    ? {
                        installation: toNumberValue(((source.globalConfig as Record<string, unknown>).additionalCosts as Record<string, unknown>).installation),
                        transport: toNumberValue(((source.globalConfig as Record<string, unknown>).additionalCosts as Record<string, unknown>).transport),
                        loadingUnloading: toNumberValue(((source.globalConfig as Record<string, unknown>).additionalCosts as Record<string, unknown>).loadingUnloading),
                        discountPercent: toNumberValue(((source.globalConfig as Record<string, unknown>).additionalCosts as Record<string, unknown>).discountPercent),
                      }
                    : undefined,
              }
            : undefined,
        generatedId: toStringValue(source.generatedId) || undefined,
        createdAt: toStringValue(source.createdAt) || toStringValue(source.date) || undefined,
        updatedAt: toStringValue(source.updatedAt) || undefined,
        __v: typeof source.__v === "number" ? source.__v : undefined,
      };
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
