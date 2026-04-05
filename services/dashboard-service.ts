import type { DashboardMetric } from "@/types/dashboard";

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  return Promise.resolve([
    { id: "quotes", label: "Total Quotations", value: "184", change: "+12.4%" },
    { id: "conversion", label: "Conversion Rate", value: "38%", change: "+4.2%" },
    { id: "orders", label: "Orders Pipeline", value: "57", change: "+9 open" },
    { id: "revenue", label: "Revenue", value: "₹1.84Cr", change: "+18.1%" },
    { id: "tasks", label: "Pending Tasks", value: "23", change: "7 urgent" }
  ]);
}
