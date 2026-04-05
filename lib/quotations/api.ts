import { finishes } from "@/modules/quotation/data/catalog";
import type { Description, OptionsResponse } from "@/lib/quotations/types";

const systems = ["Casement", "Sliding", "Slide N Fold"];

const seriesMap: Record<string, string[]> = {
  Casement: ["A65 Casement", "Thermo70", "Villa Max"],
  Sliding: ["A50 Sliding", "Slimline Premium", "Lift & Slide Pro"],
  "Slide N Fold": ["Slide N Fold 45", "Slide N Fold 60"]
};

const descriptionMap: Record<string, Description[]> = {
  "Casement::A65 Casement": [
    { name: "Fix", baseRates: [780, 840, 920], defaultHandleCount: 0 },
    { name: "Left Openable", baseRates: [980, 1040, 1120], defaultHandleCount: 1 },
    { name: "Right Openable", baseRates: [980, 1040, 1120], defaultHandleCount: 1 },
    { name: "French Window", baseRates: [1180, 1240, 1320], defaultHandleCount: 2 },
    { name: "Top Hung Window", baseRates: [920, 980, 1060], defaultHandleCount: 1 },
    { name: "Tilt and Turn Window", baseRates: [1280, 1360, 1450], defaultHandleCount: 1 }
  ],
  "Casement::Thermo70": [
    { name: "Fix", baseRates: [860, 940, 1010], defaultHandleCount: 0 },
    { name: "Left Openable", baseRates: [1080, 1140, 1220], defaultHandleCount: 1 },
    { name: "Right Openable", baseRates: [1080, 1140, 1220], defaultHandleCount: 1 }
  ],
  "Sliding::A50 Sliding": [
    { name: "2 Panel", baseRates: [980, 1060, 1140], defaultHandleCount: 1 },
    { name: "3 Panel", baseRates: [1080, 1140, 1240], defaultHandleCount: 1 },
    { name: "2 Track 2 Glass + 1 Mesh", baseRates: [1120, 1200, 1280], defaultHandleCount: 1 }
  ],
  "Sliding::Slimline Premium": [
    { name: "2 Panel", baseRates: [1320, 1410, 1520], defaultHandleCount: 1 },
    { name: "3 Panel", baseRates: [1420, 1510, 1620], defaultHandleCount: 1 }
  ],
  "Slide N Fold::Slide N Fold 45": [
    { name: "2 Panel (1+1)", baseRates: [1580, 1660, 1760], defaultHandleCount: 1 },
    { name: "3 Panel (1+2)", baseRates: [1680, 1760, 1860], defaultHandleCount: 1 },
    { name: "4 Panel (1+3)", baseRates: [1780, 1860, 1980], defaultHandleCount: 1 }
  ],
  "Slide N Fold::Slide N Fold 60": [
    { name: "5 Panel (1+4)", baseRates: [1880, 1960, 2080], defaultHandleCount: 1 },
    { name: "6 Panel (1+5)", baseRates: [1980, 2060, 2180], defaultHandleCount: 1 }
  ]
};

const defaultOptions: OptionsResponse = {
  colorFinishes: finishes.map((name, index) => ({ name, rate: [0, 35, 52, 60, 68][index] ?? 45 })),
  meshTypes: [
    { name: "SS Mesh", rate: 95 },
    { name: "Pleated Mesh", rate: 130 },
    { name: "Invisible Mesh", rate: 160 }
  ],
  glassSpecs: [
    { name: "5mm Clear", rate: 0 },
    { name: "Double Glazed 24mm", rate: 180 },
    { name: "Laminated", rate: 240 },
    { name: "Low-E DGU", rate: 320 },
    { name: "Yes", rate: 0 }
  ],
  handleOptions: [
    {
      name: "Standard Handle",
      colors: [
        { name: "Black", rate: 950 },
        { name: "Silver", rate: 900 },
        { name: "White", rate: 860 }
      ]
    },
    {
      name: "Premium Handle",
      colors: [
        { name: "Black", rate: 1450 },
        { name: "Champagne", rate: 1520 },
        { name: "Bronze", rate: 1600 }
      ]
    }
  ]
};

export async function fetchSystems() {
  return Promise.resolve({ systems });
}

export async function fetchSeries(systemType: string) {
  return Promise.resolve({ series: seriesMap[systemType] ?? [] });
}

export async function fetchDescriptions(systemType: string, series: string) {
  return Promise.resolve({ descriptions: descriptionMap[`${systemType}::${series}`] ?? [] });
}

export async function fetchOptions(_systemType: string) {
  return Promise.resolve(defaultOptions);
}
