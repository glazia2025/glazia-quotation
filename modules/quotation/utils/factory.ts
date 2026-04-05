import type { Quotation, QuotationItem, QuotationRevision } from "@/types/quotation";

function createDefaultItem(): QuotationItem {
  return {
    id: crypto.randomUUID(),
    projectLocation: "Living Room",
    productType: "Window",
    material: "Aluminium",
    series: "A50 Sliding",
    designType: "2 Track 2 Panel",
    openingType: "Sliding",
    width: 72,
    height: 60,
    quantity: 2,
    glassType: "Double Glazed 24mm",
    accessories: ["handle", "lock"],
    colorFinish: "Matte Black",
    specialNotes: "",
    rate: 1150,
    laborRate: 48,
    transportRate: 350,
    discountPercent: 5,
    previewPanels: 2
  };
}

export function createRevision(version: string, summary: string): QuotationRevision {
  return {
    id: crypto.randomUUID(),
    version,
    by: "Arjun Kapoor",
    at: new Date().toISOString(),
    summary,
    snapshotTotals: {
      subtotal: 0,
      accessoriesTotal: 0,
      laborTotal: 0,
      transportTotal: 0,
      discountTotal: 0,
      taxableAmount: 0,
      taxTotal: 0,
      grandTotal: 0
    }
  };
}

export function createEmptyQuotation(partial?: Partial<Quotation>): Quotation {
  return {
    id: partial?.id ?? crypto.randomUUID(),
    quoteNo: partial?.quoteNo ?? `QT-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
    status: partial?.status ?? "Draft",
    customer: partial?.customer ?? {
      customerName: "",
      contactPerson: "",
      phone: "",
      email: "",
      projectName: "",
      siteAddress: ""
    },
    items: partial?.items ?? [createDefaultItem()],
    terms:
      partial?.terms ??
      "Delivery within 21 working days from approved drawing and receipt of advance. GST extra as applicable. Material warranty as per manufacturer standard.",
    internalNotes: partial?.internalNotes ?? "",
    attachments: partial?.attachments ?? [
      { id: crypto.randomUUID(), name: "Facade elevation.pdf", type: "Drawing" }
    ],
    history: partial?.history ?? [
      {
        id: crypto.randomUUID(),
        title: "Quotation created",
        by: "Arjun Kapoor",
        at: new Date().toISOString(),
        description: "Initial draft prepared from CRM lead conversion"
      }
    ],
    revisions: partial?.revisions ?? [createRevision("v1", "Initial draft created")]
  };
}
