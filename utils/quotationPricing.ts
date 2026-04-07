import { getArea, getItemGrandTotal } from "@/modules/quotation/utils/calculations";
import type { QuotationItem, QuotationSubItem } from "@/types/quotation";

type AdditionalCosts = {
  installation?: number;
  transport?: number;
  loadingUnloading?: number;
  discountPercent?: number;
  showInstallation?: boolean;
  showTransport?: boolean;
  showLoadingUnloading?: boolean;
  showDiscount?: boolean;
};

export type PdfQuotationSubItem = QuotationSubItem & {
  area: number;
  amount: number;
  rate: number;
};

export type PdfQuotationItem = QuotationItem & {
  area: number;
  amount: number;
  rate: number;
  subItems?: PdfQuotationSubItem[];
};

type PricingInputItem = QuotationItem | PdfQuotationItem;

function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getItemArea(item: Pick<QuotationItem, "area" | "width" | "height">) {
  if (typeof item.area === "number" && Number.isFinite(item.area)) {
    return item.area;
  }

  return getArea(item as QuotationItem);
}

function getSubItemAmount(item: QuotationSubItem) {
  const explicitAmount = toNumber(item.amount);
  if (explicitAmount > 0) {
    return explicitAmount;
  }

  const area = typeof item.area === "number" && Number.isFinite(item.area) ? item.area : getItemArea(item);
  const quantity = Math.max(1, toNumber(item.quantity) || 1);
  return area * toNumber(item.rate) * quantity;
}

function normalizeSubItem(item: QuotationSubItem): PdfQuotationSubItem {
  return {
    ...item,
    area: typeof item.area === "number" && Number.isFinite(item.area) ? item.area : getItemArea(item),
    amount: getSubItemAmount(item),
    rate: toNumber(item.rate)
  };
}

function normalizeItem(item: PricingInputItem): PdfQuotationItem {
  const normalizedSubItems = Array.isArray(item.subItems) ? item.subItems.map(normalizeSubItem) : undefined;
  const areaFromSubItems = normalizedSubItems?.reduce((sum, entry) => sum + entry.area, 0) ?? 0;
  const amountFromSubItems = normalizedSubItems?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const explicitAmount = toNumber(item.amount);

  return {
    ...item,
    area: areaFromSubItems || getItemArea(item),
    amount: explicitAmount || amountFromSubItems || getItemGrandTotal(item),
    rate: toNumber(item.rate),
    subItems: normalizedSubItems
  };
}

export function calculateQuotationPricing(items: PricingInputItem[], additionalCosts?: AdditionalCosts, profitPercentage = 0) {
  const normalizedItems = items.map(normalizeItem);
  const baseTotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
  const totalArea = normalizedItems.reduce((sum, item) => sum + item.area * Math.max(1, toNumber(item.quantity) || 1), 0);
  const totalQty = normalizedItems.reduce((sum, item) => sum + Math.max(1, toNumber(item.quantity) || 1), 0);

  const profitValue = (baseTotal * toNumber(profitPercentage)) / 100;
  const installationCost = totalArea * toNumber(additionalCosts?.installation);
  const transportCost = toNumber(additionalCosts?.transport);
  const loadingUnloadingCost = toNumber(additionalCosts?.loadingUnloading);
  const discountValue =
    ((baseTotal + profitValue + installationCost + transportCost + loadingUnloadingCost) * toNumber(additionalCosts?.discountPercent)) / 100;
  const totalProjectCost = baseTotal + profitValue + installationCost + transportCost + loadingUnloadingCost - discountValue;
  const gstValue = totalProjectCost * 0.18;
  const grandTotal = totalProjectCost + gstValue;

  return {
    items: normalizedItems,
    baseTotal,
    totalArea,
    totalQty,
    profitValue,
    installationCost,
    transportCost,
    loadingUnloadingCost,
    discountValue,
    totalProjectCost,
    gstValue,
    grandTotal,
    avgWithoutGst: totalArea > 0 ? totalProjectCost / totalArea : 0,
    avgWithGst: totalArea > 0 ? grandTotal / totalArea : 0
  };
}
