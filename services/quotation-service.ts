import type { Quotation } from "@/types/quotation";
import { createEmptyQuotation } from "@/modules/quotation/utils/factory";

export async function getQuotations(): Promise<Quotation[]> {
  return Promise.resolve([
    createEmptyQuotation({
      id: "QT-2026-014",
      quoteNo: "QT-2026-014",
      status: "Draft",
      customer: {
        customerName: "Skyline Residences",
        contactPerson: "Raghav Mehta",
        email: "raghav@skyline.com",
        phone: "+91 9876543210",
        projectName: "Tower B Facade",
        siteAddress: "Sarjapur Road, Bengaluru"
      }
    }),
    createEmptyQuotation({
      id: "QT-2026-011",
      quoteNo: "QT-2026-011",
      status: "Approved",
      customer: {
        customerName: "Oakline Villas",
        contactPerson: "Akhil Nair",
        email: "akhil@oakline.in",
        phone: "+91 9123456780",
        projectName: "Villa Cluster Phase 2",
        siteAddress: "Kakkanad, Kochi"
      }
    })
  ]);
}

export async function saveQuotationDraft(quotation: Quotation) {
  return Promise.resolve({
    ...quotation,
    history: [
      {
        id: crypto.randomUUID(),
        title: "Draft autosaved",
        by: "Current user",
        at: new Date().toISOString(),
        description: "Changes were saved to the latest draft"
      },
      ...quotation.history
    ]
  });
}
