import type { Quotation, QuotationItem } from "@/types/quotation";

export function createDefaultItem(id: string = crypto.randomUUID()): QuotationItem {
  return {
    id,
    configuratorStep: "draft",
    refCode: "",
    projectLocation: "",
    location: "",
    area: 0,
    productType: "Window",
    systemType: "",
    material: "",
    series: "",
    description: "",
    designType: "",
    openingType: "",
    width: 1500,
    height: 1500,
    quantity: 1,
    amount: 0,
    glassType: "Yes",
    glassSpec: "6mm Clear Toughned",
    accessories: [],
    colorFinish: "",
    specialNotes: "",
    handleType: "",
    handleColor: "Black",
    handleCount: 0,
    meshPresent: false,
    meshType: "",
    rate: 0,
    refImage: "",
    remarks: "",
    subItems: [],
    laborRate: 0,
    transportRate: 0,
    discountPercent: 0,
    previewPanels: 1
  };
}

export function createEmptyQuotation(partial?: Partial<Quotation>): Quotation {
  return {
    _id: partial?._id,
    user: partial?.user,
    items: partial?.items ?? [],
    customerDetails: partial?.customerDetails ?? {
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: ""
    },
    quotationDetails: partial?.quotationDetails ?? {
      id: crypto.randomUUID(),
      terms:
        "Delivery within 21 working days from approved drawing and receipt of advance. GST extra as applicable. Material warranty as per manufacturer standard.",
      date: new Date().toISOString().slice(0, 10),
      opportunity: "",
      notes: ""
    },
    breakdown: partial?.breakdown ?? {
      totalAmount: 0,
      profitPercentage: 0
    },
    globalConfig: partial?.globalConfig ?? {
      logo: "",
      terms: "",
      prerequisites: "",
      additionalCosts: {
        installation: 0,
        transport: 0,
        loadingUnloading: 0,
        discountPercent: 0
      }
    },
    generatedId: partial?.generatedId ?? "",
    createdAt: partial?.createdAt,
    updatedAt: partial?.updatedAt,
    __v: partial?.__v
  };
}
