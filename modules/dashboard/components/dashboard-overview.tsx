"use client";

import { CalendarDays, ArrowUpRight, ClipboardList, WalletCards } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getDashboardMetrics } from "@/services/dashboard-service";
import { PageShell } from "@/components/shared/page-shell";

const tasks = [
  { title: "Survey pending for Skyline Residences", owner: "Survey Team", due: "Today 4:30 PM" },
  { title: "Approve quotation revision QT-2026-014", owner: "Sales Manager", due: "Tomorrow" },
  { title: "Dispatch slot missing for Order SO-00291", owner: "Logistics", due: "Apr 07" }
];

export function DashboardOverview() {
  const { data } = useTenantQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: getDashboardMetrics
  });
  const pipelineCards = [
    { label: "New Orders", value: "14", Icon: ClipboardList },
    { label: "Production", value: "22", Icon: ArrowUpRight },
    { label: "Dispatch", value: "6", Icon: CalendarDays },
    { label: "Collections", value: "₹36L", Icon: WalletCards }
  ];

  return (
    <PageShell title="Operations Dashboard" description="Daily snapshot across quotation performance, downstream fulfillment, and execution bottlenecks.">
      <div className="grid gap-4 lg:grid-cols-5">
        {data?.map((metric) => <StatCard key={metric.id} {...metric} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-0 bg-white/90">
          <CardHeader>
            <CardTitle>Orders Pipeline</CardTitle>
            <CardDescription>Track converted quotations through execution.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            {pipelineCards.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <Icon className="mb-3 h-5 w-5 text-teal-700" />
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-0 bg-slate-950 text-white">
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
            <CardDescription className="text-slate-300">Items that need action across functions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.map((task) => (
              <div key={task.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-medium">{task.title}</div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                  <span>{task.owner}</span>
                  <span>{task.due}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
