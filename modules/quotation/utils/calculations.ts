import { accessoryCatalog } from "@/modules/quotation/data/catalog";
import type { QuotationItem, QuotationTotals } from "@/types/quotation";

function getSafeQuantity(item: QuotationItem) {
  return Math.max(1, Number(item.quantity) || 1);
}

export function getArea(item: QuotationItem) {
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  return Number(((width * height) / 144).toFixed(2));
}

export function getPerimeter(item: QuotationItem) {
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  return Number((((width + height) * 2) / 12).toFixed(2));
}

export function getAccessoriesTotal(item: QuotationItem) {
  const area = getArea(item);
  const quantity = getSafeQuantity(item);
  const accessories = Array.isArray(item.accessories) ? item.accessories : [];

  return accessories.reduce((total, accessoryId) => {
    const accessory = accessoryCatalog.find((entry) => entry.id === accessoryId);
    if (!accessory) return total;
    if (accessory.unit === "Sq.ft") return total + accessory.rate * area * quantity;
    return total + accessory.rate * quantity;
  }, 0);
}

export function getItemBasePrice(item: QuotationItem) {
  return getArea(item) * (Number(item.rate) || 0) * getSafeQuantity(item);
}

export function getItemDiscount(item: QuotationItem) {
  const gross = getItemBasePrice(item) + getAccessoriesTotal(item);
  return (gross * (Number(item.discountPercent) || 0)) / 100;
}

export function getItemGrandTotal(item: QuotationItem) {
  const area = getArea(item);
  const quantity = getSafeQuantity(item);
  const laborTotal = area * (Number(item.laborRate) || 0) * quantity;
  const transportTotal = (Number(item.transportRate) || 0) * quantity;

  return getItemBasePrice(item) + getAccessoriesTotal(item) + laborTotal + transportTotal - getItemDiscount(item);
}

export function calculateQuotationTotals(items: QuotationItem[], taxPercent: number, globalDiscount: number): QuotationTotals {
  const subtotal = items.reduce((sum, item) => sum + getItemBasePrice(item), 0);
  const accessoriesTotal = items.reduce((sum, item) => sum + getAccessoriesTotal(item), 0);
  const laborTotal = items.reduce((sum, item) => sum + getArea(item) * (Number(item.laborRate) || 0) * getSafeQuantity(item), 0);
  const transportTotal = items.reduce((sum, item) => sum + (Number(item.transportRate) || 0) * getSafeQuantity(item), 0);
  const discountTotal = items.reduce((sum, item) => sum + getItemDiscount(item), 0) + (Number(globalDiscount) || 0);
  const taxableAmount = subtotal + accessoriesTotal + laborTotal + transportTotal - discountTotal;
  const taxTotal = (taxableAmount * (Number(taxPercent) || 0)) / 100;

  return {
    subtotal,
    accessoriesTotal,
    laborTotal,
    transportTotal,
    discountTotal,
    taxableAmount,
    taxTotal,
    grandTotal: taxableAmount + taxTotal
  };
}
