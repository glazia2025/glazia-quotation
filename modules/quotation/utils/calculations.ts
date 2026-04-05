import { accessoryCatalog } from "@/modules/quotation/data/catalog";
import type { QuotationItem, QuotationTotals } from "@/types/quotation";

export function getArea(item: QuotationItem) {
  return Number(((item.width * item.height) / 144).toFixed(2));
}

export function getPerimeter(item: QuotationItem) {
  return Number((((item.width + item.height) * 2) / 12).toFixed(2));
}

export function getAccessoriesTotal(item: QuotationItem) {
  const area = getArea(item);
  return item.accessories.reduce((total, accessoryId) => {
    const accessory = accessoryCatalog.find((entry) => entry.id === accessoryId);
    if (!accessory) return total;
    if (accessory.unit === "Sq.ft") return total + accessory.rate * area * item.quantity;
    return total + accessory.rate * item.quantity;
  }, 0);
}

export function getItemBasePrice(item: QuotationItem) {
  return getArea(item) * item.rate * item.quantity;
}

export function getItemDiscount(item: QuotationItem) {
  const gross = getItemBasePrice(item) + getAccessoriesTotal(item);
  return (gross * item.discountPercent) / 100;
}

export function getItemGrandTotal(item: QuotationItem) {
  const area = getArea(item);
  const laborTotal = area * item.laborRate * item.quantity;
  const transportTotal = item.transportRate * item.quantity;

  return getItemBasePrice(item) + getAccessoriesTotal(item) + laborTotal + transportTotal - getItemDiscount(item);
}

export function calculateQuotationTotals(items: QuotationItem[], taxPercent: number, globalDiscount: number): QuotationTotals {
  const subtotal = items.reduce((sum, item) => sum + getItemBasePrice(item), 0);
  const accessoriesTotal = items.reduce((sum, item) => sum + getAccessoriesTotal(item), 0);
  const laborTotal = items.reduce((sum, item) => sum + getArea(item) * item.laborRate * item.quantity, 0);
  const transportTotal = items.reduce((sum, item) => sum + item.transportRate * item.quantity, 0);
  const discountTotal = items.reduce((sum, item) => sum + getItemDiscount(item), 0) + globalDiscount;
  const taxableAmount = subtotal + accessoriesTotal + laborTotal + transportTotal - discountTotal;
  const taxTotal = (taxableAmount * taxPercent) / 100;

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
