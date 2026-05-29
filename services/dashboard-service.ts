import type { DashboardMetric } from "@/types/dashboard";
export function getDashboardMetrics(
  total: number,
  totalValue: number,
  confirmedOrders: number,
  conversionRate: string
): DashboardMetric[] {
  return [
    { id: "quotes", label: "Total Quotations", value: total },
    { id: "conversion", label: "Conversion Rate", value:conversionRate },
    { id: "orders", label: "Orders confirmed", value:confirmedOrders },
    { id: "revenue", label: "Revenue", value: `₹${totalValue.toLocaleString("en-IN")}`},
  ];
}
