import type { TimelineEntry } from "@/types/common";

export type QuotationStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Revised"
  | "Converted";

export interface QuotationCustomer {
  customerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  projectName: string;
  siteAddress: string;
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
  projectLocation: string;
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
  meshPresent?: string;
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
  meshPresent: string;
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

export interface QuotationRevision {
  id: string;
  version: string;
  by: string;
  at: string;
  summary: string;
  snapshotTotals: QuotationTotals;
}

export interface Quotation {
  id: string;
  quoteNo: string;
  status: QuotationStatus;
  customer: QuotationCustomer;
  items: QuotationItem[];
  terms: string;
  internalNotes: string;
  attachments: { id: string; name: string; type: string }[];
  history: TimelineEntry[];
  revisions: QuotationRevision[];
}
