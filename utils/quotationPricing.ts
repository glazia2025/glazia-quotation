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

const roundToTwo = (value: number) => Number(value.toFixed(2));

function allocateAmountIntoItems(items: PdfQuotationItem[], adjustment: number) {
  if (!items.length || Math.abs(adjustment) < 0.005) return items;

  const weights = items.map((item) => item.area * Math.max(1, toNumber(item.quantity) || 1));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const fallbackWeights = items.map((item) => Math.max(0, item.amount));
  const fallbackTotal = fallbackWeights.reduce((sum, value) => sum + value, 0);
  let allocated = 0;

  return items.map((item, index) => {
    const isLast = index === items.length - 1;
    const weight = totalWeight > 0 ? weights[index] : fallbackWeights[index];
    const weightTotal = totalWeight > 0 ? totalWeight : fallbackTotal;
    const share = isLast
      ? roundToTwo(adjustment - allocated)
      : roundToTwo(weightTotal > 0 ? adjustment * (weight / weightTotal) : adjustment / items.length);
    allocated = roundToTwo(allocated + share);
    const amount = roundToTwo(item.amount + share);
    const unitArea = weights[index];

    return {
      ...item,
      amount,
      rate: unitArea > 0 ? roundToTwo(amount / unitArea) : item.rate
    };
  });
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
  const allAdditionalCosts = installationCost + transportCost + loadingUnloadingCost;
  const hiddenAdditionalCosts =
    (additionalCosts?.showInstallation === false ? installationCost : 0) +
    (additionalCosts?.showTransport === false ? transportCost : 0) +
    (additionalCosts?.showLoadingUnloading === false ? loadingUnloadingCost : 0);
  const beforeDiscount = baseTotal + profitValue + allAdditionalCosts;
  const discountValue =
    (beforeDiscount * toNumber(additionalCosts?.discountPercent)) / 100;
  const hiddenDiscount = additionalCosts?.showDiscount === false ? discountValue : 0;
  const profitAdjustedItems = normalizedItems.map((item) => ({
    ...item,
    amount: roundToTwo(item.amount * (1 + toNumber(profitPercentage) / 100)),
    rate: roundToTwo(item.rate * (1 + toNumber(profitPercentage) / 100)),
    subItems: item.subItems?.map((subItem) => ({
      ...subItem,
      amount: roundToTwo(subItem.amount * (1 + toNumber(profitPercentage) / 100)),
      rate: roundToTwo(subItem.rate * (1 + toNumber(profitPercentage) / 100))
    }))
  }));
  const adjustedItems = allocateAmountIntoItems(
    profitAdjustedItems,
    hiddenAdditionalCosts - hiddenDiscount
  );
  const itemsSubtotal = adjustedItems.reduce((sum, item) => sum + item.amount, 0);
  const totalProjectCost = beforeDiscount - discountValue;
  const gstValue = totalProjectCost * 0.18;
  const grandTotal = totalProjectCost + gstValue;

  return {
    items: adjustedItems,
    baseTotal,
    itemsSubtotal,
    totalArea,
    totalQty,
    profitValue,
    installationCost,
    transportCost,
    loadingUnloadingCost,
    hiddenAdditionalCosts,
    beforeDiscount,
    discountPercent: toNumber(additionalCosts?.discountPercent),
    discountValue,
    totalProjectCost,
    gstValue,
    grandTotal,
    avgWithoutGst: totalArea > 0 ? totalProjectCost / totalArea : 0,
    avgWithGst: totalArea > 0 ? grandTotal / totalArea : 0
  };
}
