import { ExistingQuotationConfiguratorPage } from "@/modules/quotation/components/existing-quotation-configurator-page";

export default async function ExistingQuotationConfiguratorRoute({
  params
}: {
  params: Promise<{ quotationId: string; itemId: string }>;
}) {
  const { quotationId, itemId } = await params;
  return <ExistingQuotationConfiguratorPage quotationId={quotationId} itemId={itemId} />;
}
