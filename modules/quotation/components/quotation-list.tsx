"use client";

import Link from "next/link";
import { CopyPlus, Eye, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getQuotations } from "@/services/quotation-service";

export function QuotationList() {
  const { data: quotations = [] } = useTenantQuery({
    queryKey: ["quotations"],
    queryFn: getQuotations
  });

  return (
    <PageShell
      title="Quotations"
      description="Manage draft, submitted, revised, and converted quotations with pricing visibility and revision history."
      actions={
        <Button asChild>
          <Link href="/quotations/new">
            <Plus className="h-4 w-4" />
            New quotation
          </Link>
        </Button>
      }
    >
      <Card className="border-0 bg-white/90">
        <CardHeader>
          <CardTitle>Recent Quotations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotations.map((quotation) => (
            <div key={quotation.id} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1.2fr_0.8fr_auto] md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-900">{quotation.quoteNo}</h3>
                  <Badge variant={quotation.status === "Approved" ? "success" : quotation.status === "Rejected" ? "danger" : "outline"}>
                    {quotation.status}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {quotation.customer.customerName} | {quotation.customer.projectName}
                </div>
              </div>
              <div className="text-sm text-slate-600">
                <div>{quotation.items.length} configured items</div>
                <div>{quotation.revisions.length} revisions</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/quotations/new">
                    <Eye className="h-4 w-4" />
                    Open
                  </Link>
                </Button>
                <Button variant="ghost" size="sm">
                  <CopyPlus className="h-4 w-4" />
                  Duplicate
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
