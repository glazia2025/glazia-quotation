"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyPlus, Eye, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getQuotations } from "@/services/quotation-service";

export function QuotationList() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading, error } = useTenantQuery({
    queryKey: ["quotations", String(page)],
    queryFn: () => getQuotations(page, pageSize)
  });
  const quotations = data?.quotations ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

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
          {isLoading ? <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">Loading quotations...</div> : null}
          {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">Failed to load quotations.</div> : null}
          {quotations.map((quotation, index) => {
            const customerName =
              quotation.customerDetails?.name ||
              quotation.customerDetails?.company ||
              "Unknown customer";
            const quotationId = quotation._id || quotation.quotationDetails?.id || "";
            const quotationNumber = quotation.generatedId || quotation.quotationDetails?.quoteNo || quotationId;
            const quotationStatus = quotation.quotationDetails?.status || "Draft";

            return (
              <div key={`${quotationId}-${index}`} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1.2fr_0.8fr_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900">{quotationNumber}</h3>
                    <Badge variant={quotationStatus === "Approved" ? "success" : quotationStatus === "Rejected" ? "danger" : "outline"}>
                      {quotationStatus}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {customerName}
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/quotations/${quotationId}`}>
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
            );
          })}
          {!isLoading && !error && quotations.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">No quotations found.</div>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="text-sm text-slate-500">
              Page {page} of {Math.max(totalPages, 1)} | {total} quotations
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
