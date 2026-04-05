"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { formatCurrency } from "@/utils/format";
import type { Lead } from "@/types/crm";

export function LeadDetail({ lead }: { lead: Lead | undefined }) {
  if (!lead) {
    return <PageShell title="Lead not found" description="The requested lead does not exist in the current tenant context.">Missing lead</PageShell>;
  }

  return (
    <PageShell
      title={lead.company}
      description="Lead details, next actions, and quotation conversion entry point."
      actions={
        <Button asChild>
          <Link href="/quotations/new">Convert To Quotation</Link>
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-0 bg-white/90">
          <CardHeader>
            <CardTitle>Lead Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">Contact</div>
              <div className="mt-1 font-medium text-slate-900">{lead.contactName}</div>
              <div className="text-slate-600">{lead.phone}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">Location</div>
              <div className="mt-1 font-medium text-slate-900">{lead.city}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">Potential</div>
              <div className="mt-1 font-medium text-slate-900">{formatCurrency(lead.potentialValue)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-slate-950 text-white">
          <CardHeader>
            <CardTitle>Suggested actions</CardTitle>
            <CardDescription className="text-slate-300">
              Prepare baseline pricing, confirm system series, and schedule site survey after commercial validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/5 p-4">Create a quotation with standard slider and casement packages for initial discussion.</div>
            <div className="rounded-2xl bg-white/5 p-4">Capture facade drawings and expected glass performance requirements.</div>
            <div className="rounded-2xl bg-white/5 p-4">Prepare alternate series option to handle negotiation on budget.</div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
