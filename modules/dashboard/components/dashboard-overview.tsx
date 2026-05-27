"use client";

import { CalendarDays, ArrowUpRight, ClipboardList, WalletCards } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getDashboardMetrics } from "@/services/dashboard-service";
import { PageShell } from "@/components/shared/page-shell";
import { getQuotations } from "@/services/quotation-service";
import { QUOTATION_API_BASE_URL } from "@/services/api";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from "chart.js";

import { Line } from "react-chartjs-2";
import { useState } from "react";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);
const tasks = [
  { title: "Survey pending for Skyline Residences", owner: "Survey Team", due: "Today 4:30 PM" },
  { title: "Approve quotation revision QT-2026-014", owner: "Sales Manager", due: "Tomorrow" },
  { title: "Dispatch slot missing for Order SO-00291", owner: "Logistics", due: "Apr 07" }
];

export function DashboardOverview() {
  const page = 1;
const pageSize = 20;
  const { data: quotationData } = useTenantQuery({
  queryKey: ["quotations", String(page)],
  queryFn: () => getQuotations(page, pageSize)
});

  const userId = quotationData?.quotations?.[0]?.user?.toString() || "";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear.toString());

const { data: chartApiData } = useTenantQuery({
  queryKey: ["chart-data", year, userId],
  enabled: !!userId,
  queryFn: async () => {
    const res = await fetch(
      `${QUOTATION_API_BASE_URL}/api/quotations/chart/${userId}?year=${year}`
    );
    return res.json();
  }
});
console.log(chartApiData);
const labels = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];
const enquiry = labels.map((month) => {
  const found = chartApiData?.find((item: any) => item.month === month);
  return found?.data?.enquiry || 0;
});
const { data: stats } = useTenantQuery({
  queryKey: ["dashboard-stats", year, userId],
  enabled: !!userId,
  queryFn: async () => {
    const res = await fetch(
      `${QUOTATION_API_BASE_URL}/api/quotations/stats/${userId}?year=${year}`
    );
    return res.json();
  }
});

const confirmed = labels.map((month) => {
  const found = chartApiData?.find((item: any) => item.month === month);
  return found?.data?.order_confirmed || 0;
});

const lost = labels.map((month) => {
  const found = chartApiData?.find((item: any) => item.month === month);
  return found?.data?.order_lost || 0;
});

const Quoted = labels.map((month) => {
  const found = chartApiData?.find((item: any) => item.month === month);
  return found?.data?.quoted || 0;
});

const UnderNegotiation = labels.map((month) => {
  const found = chartApiData?.find((item: any) => item.month === month);
  return found?.data?.under_negotiation || 0;
});

const chartData = {
  labels,
datasets: [
  {
    label: "Enquiry",
    data: enquiry,
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f6",
    pointRadius: 6
  },
  {
    label: "Order Confirmed",
    data: confirmed,
    borderColor: "#22c55e",
    backgroundColor: "#22c55e",
    pointRadius: 6
  },
  {
    label: "Order Lost",
    data: lost,
    borderColor: "#ef4444",
    backgroundColor: "#ef4444",
    pointRadius: 6
  },
   {
    label: "Quoted",
    data: Quoted,
    borderColor: "#F59E0B",
    backgroundColor: "#F59E0B",
    pointRadius: 6
  },
   {
    label: "Under Negotiation",
    data: UnderNegotiation,
    borderColor: "#8B5CF6",
    backgroundColor: "#8B5CF6",
    pointRadius: 6
  }
]
};
 const quotations = quotationData?.quotations ?? [];
const filteredQuotations=quotations.filter((q)=>{
  if (!q.quotationDetails?.date) return false;

  const date =new Date(q.quotationDetails?.date);
  return date.getFullYear().toString()===year;
});


const total = stats?.total || 0;
const confirmedOrders = stats?.confirmed || 0;
const totalValue = stats?.revenue || 0;

const conversionRate =
  total > 0 ? ((confirmedOrders / total) * 100).toFixed(1) + "%" : "0%";


const metrics = getDashboardMetrics(total, totalValue,confirmedOrders,conversionRate);
  const pipelineCards = [
    { label: "New Orders", value: "14", Icon: ClipboardList },
    { label: "Production", value: "22", Icon: ArrowUpRight },
    { label: "Dispatch", value: "6", Icon: CalendarDays },
    { label: "Collections", value: "₹36L", Icon: WalletCards }
  ];
  const years =[
      currentYear-2,
      currentYear-1,
      currentYear,
      currentYear+1,
    ];
  return (
    <PageShell title="Operations Dashboard" description="Daily snapshot across quotation performance, downstream fulfillment, and execution bottlenecks."
     actions={
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-black">Year:</span>
      <select
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="border px-3 py-1.5 rounded-md"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  }
  >
      <div className="grid gap-6">
        <Card>
  <CardHeader className="flex flex-row items-center justify-between">

  <CardTitle className="text-left">
    Opportunity Trends
  </CardTitle>
</CardHeader>

  <CardContent className="h-[400px]">
    {/* Chart */}
    {chartApiData ? (
      <Line
  data={chartData}
  options={{
    responsive: true,
     maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top"
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    },
    
  }}
/>
    ) : (
      <p>Loading chart...</p>
    )}
  </CardContent>
</Card>
        
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {metrics?.map((metric) => <StatCard key={metric.id} {...metric} />)}
      </div>
    </PageShell>
  );
}
