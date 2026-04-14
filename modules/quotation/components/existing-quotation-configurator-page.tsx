"use client";

import { FullPageConfigurator } from "@/modules/product-configurator/components/full-page-configurator";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { getQuotation } from "@/services/quotation-service";

export function ExistingQuotationConfiguratorPage({
  quotationId,
  itemId
}: {
  quotationId: string;
  itemId: string;
}) {
  const { data: quotation, isLoading } = useTenantQuery({
    queryKey: ["quotation", quotationId],
    queryFn: () => getQuotation(quotationId)
  });

  if (isLoading || !quotation) {
    return <div className="min-h-screen bg-[linear-gradient(180deg,#e2e8f0_0%,#f8fafc_100%)]" />;
  }

  return <FullPageConfigurator itemId={itemId} initialQuotation={quotation} returnPath={`/quotations/${quotationId}`} />;
}
