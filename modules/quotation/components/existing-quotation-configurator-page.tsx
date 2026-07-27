"use client";

import { useEffect, useState } from "react";

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
  const [hasHydrated, setHasHydrated] = useState(false);
  const { data: quotation, isLoading } = useTenantQuery({
    queryKey: ["quotation", quotationId],
    queryFn: () => getQuotation(quotationId)
  });

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated || isLoading || !quotation) {
    return <div className="min-h-screen bg-[linear-gradient(180deg,#e2e8f0_0%,#f8fafc_100%)]" />;
  }

  return (
    <FullPageConfigurator
      itemId={itemId}
      initialQuotation={quotation}
      returnPath={`/quotations/${quotationId}`}
      quotationQueryKey={quotationId}
    />
  );
}
