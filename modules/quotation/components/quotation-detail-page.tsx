"use client";

import { PageShell } from "@/components/shared/page-shell";
import { QuotationBuilder } from "@/modules/quotation/components/quotation-builder";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getQuotation } from "@/services/quotation-service";

export function QuotationDetailPage({ quotationId }: { quotationId: string }) {
  const { data: quotation, isLoading, error } = useTenantQuery({
    queryKey: ["quotation", quotationId],
    queryFn: () => getQuotation(quotationId)
  });

  if (isLoading) {
    return (
      <PageShell title="Loading quotation" description={`#${quotationId}`}>
        <div className="rounded-2xl border bg-white/90 p-6 text-sm text-slate-500">Loading quotation details...</div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Unable to load quotation" description={`#${quotationId}`}>
        <div className="rounded-2xl border bg-white/90 p-6 text-sm text-slate-500">The quotation could not be loaded.</div>
      </PageShell>
    );
  }

  if (!quotation) {
    return (
      <PageShell title="Quotation not found" description={`#${quotationId}`}>
        <div className="rounded-2xl border bg-white/90 p-6 text-sm text-slate-500">No quotation was found for this id.</div>
      </PageShell>
    );
  }

  return <QuotationBuilder initialQuotation={quotation} quotationBasePath={`/quotations/${quotationId}`} />;
}
