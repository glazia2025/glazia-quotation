// import { QuotationDetailPage } from "@/modules/quotation/components/quotation-detail-page";

// export default async function QuotationDetailRoute({ params }: { params: Promise<{ quotationId: string }> }) {
//   const { quotationId } = await params;
//   return <QuotationDetailPage quotationId={quotationId} />;
// }

import { redirect } from "next/navigation";
import { QuotationDetailPage } from "@/modules/quotation/components/quotation-detail-page";

export default async function QuotationDetailRoute({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const { quotationId } = await params;
  const isValidId = /^[0-9a-fA-F]{24}$/.test(quotationId);

  if (!isValidId) {
    redirect("https://www.glazia.in");
  }
  return <QuotationDetailPage quotationId={quotationId} />;
}