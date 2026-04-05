import type { AccessoryOption } from "@/types/quotation";

export const materials = ["Aluminium", "uPVC", "System Aluminium"];

export const seriesByMaterial: Record<string, string[]> = {
  Aluminium: ["A50 Sliding", "A65 Casement", "Slimline Premium"],
  uPVC: ["Eco60", "Thermo70", "Villa Max"],
  "System Aluminium": ["Facade Grid", "Lift & Slide Pro", "Acoustic Shield"]
};

export const designsBySeries: Record<string, string[]> = {
  "A50 Sliding": ["2 Track 2 Panel", "3 Track 3 Panel"],
  "A65 Casement": ["Single Shutter", "French Window"],
  "Slimline Premium": ["Minimal Slider", "Corner Slider"],
  Eco60: ["Casement Basic", "Arch Window"],
  Thermo70: ["Tilt & Turn", "Dual Open"],
  "Villa Max": ["Bay Window", "Fixed + Openable"],
  "Facade Grid": ["Curtain Wall", "Spider Glazing"],
  "Lift & Slide Pro": ["Large Slider", "Pocket Slider"],
  "Acoustic Shield": ["Sound Proof Fixed", "Acoustic Openable"]
};

export const openingsByDesign: Record<string, string[]> = {
  "2 Track 2 Panel": ["Sliding"],
  "3 Track 3 Panel": ["Sliding"],
  "Single Shutter": ["Casement"],
  "French Window": ["French"],
  "Minimal Slider": ["Sliding"],
  "Corner Slider": ["Sliding Corner"],
  "Casement Basic": ["Casement"],
  "Arch Window": ["Top Hung"],
  "Tilt & Turn": ["Tilt & Turn"],
  "Dual Open": ["Casement + Mesh"],
  "Bay Window": ["Bay"],
  "Fixed + Openable": ["Mixed"],
  "Curtain Wall": ["Fixed"],
  "Spider Glazing": ["Fixed"],
  "Large Slider": ["Lift & Slide"],
  "Pocket Slider": ["Pocket"],
  "Sound Proof Fixed": ["Fixed"],
  "Acoustic Openable": ["Casement"]
};

export const glassTypes = ["5mm Clear", "Double Glazed 24mm", "Laminated", "Low-E DGU"];
export const finishes = ["Matte Black", "Anodized Natural", "Champagne Gold", "Textured Grey", "Walnut"];

export const accessoryCatalog: AccessoryOption[] = [
  { id: "mesh", name: "Mesh Shutter", rate: 85, unit: "Sq.ft" },
  { id: "handle", name: "Premium Handle", rate: 1350, unit: "Nos" },
  { id: "lock", name: "Multi Point Lock", rate: 4200, unit: "Nos" },
  { id: "silicone", name: "Structural Silicone", rate: 22, unit: "Sq.ft" },
  { id: "motor", name: "Motorized Operator", rate: 16500, unit: "Nos" }
];

export function getSeries(material: string) {
  return seriesByMaterial[material] ?? [];
}

export function getDesigns(series: string) {
  return designsBySeries[series] ?? [];
}

export function getOpenings(design: string) {
  return openingsByDesign[design] ?? [];
}
