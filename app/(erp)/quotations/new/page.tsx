import { QuotationBuilder } from "@/modules/quotation/components/quotation-builder";
import { createEmptyQuotation } from "@/modules/quotation/utils/factory";

export default function NewQuotationPage() {
  return <QuotationBuilder initialQuotation={createEmptyQuotation()} quotationBasePath="/quotations/new" />;
}
