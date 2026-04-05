"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getLeads } from "@/services/crm-service";
import { formatCurrency } from "@/utils/format";
import type { LeadStage } from "@/types/crm";

const stageVariant: Record<LeadStage, "default" | "success" | "warning"> = {
  new: "default",
  qualified: "default",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "default"
};

export function LeadsBoard() {
  const { data: leads = [] } = useTenantQuery({
    queryKey: ["crm-leads"],
    queryFn: getLeads
  });

  const pipelineStages: LeadStage[] = ["new", "qualified", "proposal", "negotiation", "won"];

  return (
    <PageShell
      title="CRM Pipeline"
      description="Manage leads, move them through the sales stages, and convert ready opportunities into quotations."
      actions={
        <Button asChild>
          <Link href="/quotations/new">Create Quotation</Link>
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-0 bg-white/90">
          <CardHeader>
            <CardTitle>Pipeline View</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-5">
            {pipelineStages.map((stage) => (
              <div key={stage} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold capitalize text-slate-700">{stage}</h3>
                  <Badge variant={stageVariant[stage]}>{leads.filter((lead) => lead.stage === stage).length}</Badge>
                </div>
                <div className="space-y-3">
                  {leads
                    .filter((lead) => lead.stage === stage)
                    .map((lead) => (
                      <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="block rounded-2xl bg-white p-3 shadow-sm transition hover:-translate-y-0.5">
                        <div className="font-medium text-slate-900">{lead.company}</div>
                        <div className="mt-1 text-sm text-slate-500">{lead.contactName}</div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{lead.city}</span>
                          <span>{formatCurrency(lead.potentialValue)}</span>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-0 bg-slate-950 text-white">
          <CardHeader>
            <CardTitle>Leads List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{lead.company}</div>
                  <Badge variant={lead.stage === "won" ? "success" : "outline"} className="capitalize text-white">
                    {lead.stage}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-slate-300">{lead.contactName}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{lead.phone}</span>
                  <span>{formatDistanceToNow(new Date(lead.lastActivity), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
