"use client";

import { CalendarDays, ArrowUpRight, ClipboardList, WalletCards } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getDashboardMetrics } from "@/services/dashboard-service";
import { PageShell } from "@/components/shared/page-shell";
import { QUOTATION_API_BASE_URL } from "@/services/api";
import Link from "next/link";

import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement
} from "chart.js";

import { Line, Doughnut,Bar } from "react-chartjs-2";
import { useState } from "react";

ChartJS.register(LineElement,BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend,ArcElement);
const tasks = [
  { title: "Survey pending for Skyline Residences", owner: "Survey Team", due: "Today 4:30 PM" },
  { title: "Approve quotation revision QT-2026-014", owner: "Sales Manager", due: "Tomorrow" },
  { title: "Dispatch slot missing for Order SO-00291", owner: "Logistics", due: "Apr 07" }
];

export function DashboardOverview() {
  let userId = null;
try {
  const user = JSON.parse(localStorage.getItem("glazia-user") || "{}");
  userId = user?.id;
  if (!userId) {
    const auth = JSON.parse(localStorage.getItem("glazia-auth") || "{}");
    userId = auth?.state?.user?.id;
  }
} catch (e) {
  console.log("Error reading userId");
}
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

const { data: salesPerMonth } = useTenantQuery({
  queryKey: ["sales-per-month", year, userId],
  enabled: !!userId,
  queryFn: async () => {
    const res = await fetch(
      `${QUOTATION_API_BASE_URL}/api/quotations/sales-per-month/${userId}?year=${year}`
    );
    return res.json();
  }
});
console.log(chartApiData);
const labels = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

const salesData = labels.map((month) => {
  const found = salesPerMonth?.find(
    (item: any) => item.month === month
  );

  return found?.sales || 0;
});

const salesChartData = {
  labels,
  datasets: [
    {
      label: "Sales",
      data: salesData,
      borderColor: "#EE1C25",
      backgroundColor: "#EE1C25",
      pointBackgroundColor: "#ffffff",
      pointBorderColor: "#EE1C25",
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 5,
      borderWidth: 2,
      tension: 0.3,
    },
  ],
};

const salesChartOptions = {
  responsive: true,
  maintainAspectRatio: false,

  plugins: {
    legend: {
      display: false,
    },

    tooltip: {
      enabled: true,
      callbacks: {
        label: function (context: any) {
          return `₹${context.parsed.y.toLocaleString("en-IN")}`;
        },
      },
    },
  },

  scales: {
    y: {
      beginAtZero: true,

      ticks: {
        callback: function (value: any) {
          return `₹${Number(value).toLocaleString("en-IN")}`;
        },
      },

      grid: {
        color: "#e2e8f0",
      },
    },

    x: {
      grid: {
        display: false,
      },
    },
  },
};

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

const stageTotals = {
  enquiry: enquiry.reduce((sum, value) => sum + value, 0),
  orderConfirmed: confirmed.reduce((sum, value) => sum + value, 0),
  orderLost: lost.reduce((sum, value) => sum + value, 0),
  quoted: Quoted.reduce((sum, value) => sum + value, 0),
  underNegotiation: UnderNegotiation.reduce((sum, value) => sum + value, 0),
};

const stageChartData = {
  labels: [
    "Enquiry",
    "Order Confirmed",
    "Order Lost",
    "Quoted",
    "Under Negotiation",
  ],
  datasets: [
    {
      data: [
        stageTotals.enquiry,
        stageTotals.orderConfirmed,
        stageTotals.orderLost,
        stageTotals.quoted,
        stageTotals.underNegotiation,
      ],
      backgroundColor: [
        "#CBD5E1",
        "#475569",
        "#E63946",
        "#7B8DA6",
        "#0B1120",
      ],
      borderRadius: 3,
      barThickness: 26,
    },
  ],
};

const stageChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
      grid: {
        display: false,
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: {
          size: 9,
        },
      },
    },
  },
};

// const conversionValue = Number(
//   conversionRate.replace("%", "")
// );

// const conversionChartData = {
//   datasets: [
//     {
//       data: [conversionValue, 100 - conversionValue],
//       backgroundColor: [
//         "#EE1C25",
//         "#F5D1D3",
//       ],
//       borderWidth: 0,
//       cutout: "78%",
//     },
//   ],
// };

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
const total = stats?.total || 0;
const confirmedOrders = stats?.confirmed || 0;
const totalValue = stats?.revenue || 0;

const conversionRate =
  total > 0 ? ((confirmedOrders / total) * 100).toFixed(1) + "%" : "0%";

  const conversionValue = Number(
  conversionRate.replace("%", "")
);

const conversionChartData = {
  datasets: [
    {
      data: [conversionValue, 100 - conversionValue],
      backgroundColor: [
        "#EE1C25",
        "#F5D1D3",
      ],
      borderWidth: 0,
      cutout: "78%",
    },
  ],
};

const conversionChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: false,
    },
  },
};


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
    <PageShell title="Dashboard" description="Daily snapshot across quotation performance, downstream fulfillment, and execution bottlenecks."
     actions={
    <div className="flex items-center gap-2">
      {/* <span className="text-sm font-medium text-black">Year:</span>
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
      </select> */}
      <span className="text-sm font-medium text-slate-500">Year:</span>

  <div className="relative">
    <select
      value={year}
      onChange={(e) => setYear(e.target.value)}
      className="h-10 appearance-none rounded-lg border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-300 focus:border-slate-300"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>

    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-800">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    </span>
  </div>

      {/* <button
        type="button"
          <Link href="/quotations/new">
        className="rounded-md px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        style={{ backgroundColor: "#EE1C25" }}
      >
        + Add Quotation
        </Link>
      </button> */}
      <Link
  href="/quotations/new"
  className="rounded-md px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
  style={{ backgroundColor: "#EE1C25" }}
>
  + Add Quotation
</Link>
    </div>
  }
  >
    <div className="grid gap-4 lg:grid-cols-4">
        {metrics?.map((metric) => <StatCard key={metric.id} {...metric} />)}
      </div>
      <div className="grid gap-6">
        <Card>
  <CardHeader className="flex flex-row items-center justify-between">

  {/* <CardTitle className="text-left">
    Opportunity Trends
  </CardTitle> */}
  <CardTitle className="text-left">
  Sales per Month
</CardTitle>


</CardHeader>

  <CardContent className="h-[400px]">
    {/* Chart */}
    {/* {chartApiData ? (
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
    )} */}

    {salesPerMonth ? (
  <Line
    data={salesChartData}
    options={salesChartOptions}
  />
) : (
  <p>Loading chart...</p>
)}
  </CardContent>
</Card>

<div className="grid gap-4 lg:grid-cols-2">
  
  {/* Stage Totals */}
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold">
        Stage Totals (Year)
      </CardTitle>
    </CardHeader>

    <CardContent>
      <div className="h-[150px]">
        <Bar
          data={stageChartData}
          options={stageChartOptions}
        />
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[10px] text-slate-400">
          Sum of monthly opportunity counts per stage across {year}.
        </p>
      </div>
    </CardContent>
  </Card>


  {/* Conversion Rate */}
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold">
        Conversion Rate
      </CardTitle>
    </CardHeader>

    <CardContent>
      <div className="relative mx-auto h-[150px] w-[150px]">
        <Doughnut
          data={conversionChartData}
          options={conversionChartOptions}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-slate-800">
            {conversionRate}
          </span>

          <span className="text-[9px] text-slate-400">
            Quotes → Orders
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] text-slate-400">
        {confirmedOrders} of {total} quotations converted to confirmed orders.
      </p>
    </CardContent>
  </Card>

</div>
        
      </div>
      {/* <div className="grid gap-4 lg:grid-cols-4">
        {metrics?.map((metric) => <StatCard key={metric.id} {...metric} />)}
      </div> */}
    </PageShell>
  );
}
