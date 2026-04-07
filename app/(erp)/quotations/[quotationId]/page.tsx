import { QuotationDetailPage } from "@/modules/quotation/components/quotation-detail-page";

export default async function QuotationDetailRoute({ params }: { params: Promise<{ quotationId: string }> }) {
  const { quotationId } = await params;
  return <QuotationDetailPage quotationId={quotationId} />;
}
