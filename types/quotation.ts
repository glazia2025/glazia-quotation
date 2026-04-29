export interface QuotationCustomerDetails {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface QuotationDetails {
  id: string;
  terms: string;
  date?: string;
  opportunity?: string;
  notes?: string;
}

export interface AccessoryOption {
  id: string;
  name: string;
  rate: number;
  unit: "Nos" | "Set" | "Sq.ft";
}

export interface ProductCatalogNode {
  id: string;
  name: string;
}

export interface QuotationItem {
  id: string;
  refCode?: string;
  location?: string;
  area?: number;
  projectLocation?: string;
  productType: string;
  systemType?: string;
  material: string;
  series: string;
  description?: string;
  designType: string;
  openingType: string;
  width: number;
  height: number;
  quantity: number;
  glassType: string;
  glassSpec?: string;
  accessories: string[];
  colorFinish: string;
  specialNotes: string;
  handleType?: string;
  handleColor?: string;
  meshType?: string;
  meshPresent?: boolean;
  configuratorStep?: string;
  rate: number;
  amount?: number;
  handleCount?: number;
  sash?: "fixed" | "left" | "right" | "double" | "top" | "bottom";
  panelSashes?: ("fixed" | "left" | "right" | "double" | "top" | "bottom")[];
  refImage?: string;
  remarks?: string;
  hasExhaustFan?: boolean;
  exhaustFanX?: number;
  exhaustFanY?: number;
  exhaustFanSize?: number;
  baseRate?: number;
  areaSlabIndex?: number;
  subItems?: QuotationSubItem[];
  configuratorLayout?: Record<string, unknown>;
  laborRate: number;
  transportRate: number;
  discountPercent: number;
  previewPanels: number;
}

export interface QuotationSubItem {
  id: string;
  refCode: string;
  location: string;
  width: number;
  height: number;
  area: number;
  systemType: string;
  series: string;
  description: string;
  colorFinish: string;
  glassSpec: string;
  handleType: string;
  handleColor: string;
  handleCount: number;
  meshPresent: boolean;
  meshType: string;
  rate: number;
  quantity: number;
  amount: number;
  sash?: "fixed" | "left" | "right" | "double" | "top" | "bottom";
  panelSashes?: ("fixed" | "left" | "right" | "double" | "top" | "bottom")[];
  refImage?: string;
  remarks?: string;
  hasExhaustFan?: boolean;
  exhaustFanX?: number;
  exhaustFanY?: number;
  exhaustFanSize?: number;
  baseRate?: number;
  areaSlabIndex?: number;
}

export interface QuotationTotals {
  subtotal: number;
  accessoriesTotal: number;
  laborTotal: number;
  transportTotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxTotal: number;
  grandTotal: number;
}

export interface Quotation {
  _id?: string;
  user?: string;
  items: QuotationItem[];
  customerDetails: QuotationCustomerDetails;
  quotationDetails: QuotationDetails;
  breakdown?: {
    totalAmount?: number;
    profitPercentage?: number;
  };
  globalConfig?: {
    logo?: string;
    terms?: string;
    prerequisites?: string;
    additionalCosts?: {
      installation?: number;
      transport?: number;
      loadingUnloading?: number;
      discountPercent?: number;
    };
  };
  generatedId?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}
