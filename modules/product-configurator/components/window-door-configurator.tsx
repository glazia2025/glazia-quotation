"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva/lib/index";
import {
  Undo2,
  Redo2,
  SplitSquareVertical,
  SplitSquareHorizontal,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { useDescriptionsQuery, useOptionsQuery, useSeriesQuery, useSystemsQuery } from "@/lib/quotations/queries";
import { fetchDescriptions, fetchOptions } from "@/lib/quotations/api";
import type { Description, HandleOption, OptionWithRate, OptionsResponse } from "@/lib/quotations/types";
import type { QuotationItem, QuotationSubItem } from "@/components/QuotationItemRow";


type KonvaGroup = InstanceType<typeof Konva.Group>;
type KonvaLayer = InstanceType<typeof Konva.Layer>;
type KonvaStage = InstanceType<typeof Konva.Stage>;

type SplitDirection = "none" | "vertical" | "horizontal";
type SystemType = "Casement" | "Sliding" | "Slide N Fold" | "Louvers" | "Exhaust Fan";
type SashType = "fixed" | "left" | "right" | "double" | "top" | "bottom";
type YesNo = "Yes" | "No";

type SectionNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  split: SplitDirection;
  ratio: number;
  sash: SashType;
  systemType: SystemType;
  series: string;
  description: string;
  hasExhaustFan?: boolean;
  exhaustFanX?: number;
  exhaustFanY?: number;
  exhaustFanSize?: number;
  panelFractions?: number[];
  panelMeshCount?: number;
  panelSashes?: SashType[];
  glass: YesNo;
  mesh: YesNo;
  children?: SectionNode[];
};

type ProductMeta = {
  productType: "Window" | "Door";
  systemType: string;
  series: string;
  description: string;
  colorFinish: string;
  glassSpec: string;
  handleType: string;
  handleColor: string;
  meshPresent: string;
  meshType: string;
  location: string;
  quantity: number;
  refCode: string;
  remarks: string;
  rate: number;
};

type SectionOptionMeta = Pick<
  ProductMeta,
  "colorFinish" | "glassSpec" | "handleType" | "handleColor" | "meshType"
>;

const DEFAULT_META: ProductMeta = {
  productType: "Window",
  systemType: "Casement",
  series: "",
  description: "",
  colorFinish: "",
  glassSpec: "",
  handleType: "",
  handleColor: "",
  meshPresent: "No",
  meshType: "",
  location: "",
  quantity: 1,
  refCode: "",
  remarks: "",
  rate: 0,
};

const DEFAULT_SECTION_OPTION_META: SectionOptionMeta = {
  colorFinish: "",
  glassSpec: "",
  handleType: "",
  handleColor: "",
  meshType: "",
};

const AREA_SLABS = [
  { max: 20, index: 0 },
  { max: 40, index: 1 },
  { max: Infinity, index: 2 },
];
const COMBINATION_SYSTEM = "Combination";
const CATALOG_SYSTEMS = new Set<SystemType>(["Casement", "Sliding", "Slide N Fold"]);
const roundToTwo = (value: number) => Number(value.toFixed(2));
const indexToAlphaLower = (index: number): string => {
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
};

const buildDefaultSlidingPanelSashes = (count: number): SashType[] =>
  Array.from({ length: count }, (_, idx) => (idx % 2 === 0 ? "left" : "right"));

const isCatalogSystem = (systemType: string): systemType is Extract<SystemType, "Casement" | "Sliding" | "Slide N Fold"> =>
  CATALOG_SYSTEMS.has(systemType as SystemType);

const isLouverSystem = (systemType: string) => systemType === "Louvers";
const isExhaustSystem = (systemType: string) => systemType === "Exhaust Fan";

const getDefaultLeafDescription = (
  systemType: SystemType,
  productType: ProductMeta["productType"],
  hasExhaustFan = false
) => {
  if (isLouverSystem(systemType)) return "Louvers";
  if (isExhaustSystem(systemType)) return "Exhaust Fan";
  if (hasExhaustFan && systemType === "Casement") return "Fix + Exhaust Fan";
  return `${systemType} ${productType}`;
};

const getSectionLabel = (leaf: SectionNode, productType: ProductMeta["productType"]) =>
  leaf.description?.trim() || getDefaultLeafDescription(leaf.systemType, productType, leaf.hasExhaustFan);

const DEFAULT_EXHAUST_FAN_X = 0.5;
const DEFAULT_EXHAUST_FAN_Y = 0.5;
const DEFAULT_EXHAUST_FAN_SIZE = 0.48;
const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const createRoot = (baseSystem: SystemType): SectionNode => ({
  id: "root",
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  split: "none",
  ratio: 0.5,
  sash: "fixed",
  systemType: baseSystem,
  series: "",
  description: isLouverSystem(baseSystem) ? "Louvers" : isExhaustSystem(baseSystem) ? "Exhaust Fan" : "",
  hasExhaustFan: isExhaustSystem(baseSystem),
  exhaustFanX: DEFAULT_EXHAUST_FAN_X,
  exhaustFanY: DEFAULT_EXHAUST_FAN_Y,
  exhaustFanSize: DEFAULT_EXHAUST_FAN_SIZE,
  glass: "Yes",
  mesh: "No",
});

const createLeaf = (
  x: number,
  y: number,
  w: number,
  h: number,
  sash: SashType,
  systemType: SystemType,
  glass: YesNo,
  mesh: YesNo
): SectionNode => ({
  id: crypto.randomUUID(),
  x,
  y,
  w,
  h,
  split: "none",
  ratio: 0.5,
  sash,
  systemType,
  series: "",
  description: isLouverSystem(systemType) ? "Louvers" : isExhaustSystem(systemType) ? "Exhaust Fan" : "",
  hasExhaustFan: isExhaustSystem(systemType),
  exhaustFanX: DEFAULT_EXHAUST_FAN_X,
  exhaustFanY: DEFAULT_EXHAUST_FAN_Y,
  exhaustFanSize: DEFAULT_EXHAUST_FAN_SIZE,
  glass: isExhaustSystem(systemType) ? "Yes" : glass,
  mesh,
});

const buildPreset = (systemType: SystemType, glass: YesNo, mesh: YesNo): SectionNode => {
  const root: SectionNode = { ...createRoot(systemType), glass, mesh };

  if (systemType === "Sliding") {
    root.split = "vertical";
    root.children = [
      createLeaf(0, 0, 0.5, 1, "left", "Sliding", glass, mesh),
      createLeaf(0.5, 0, 0.5, 1, "right", "Sliding", glass, mesh),
    ];
    return root;
  }

  if (systemType === "Slide N Fold") {
    root.split = "vertical";
    root.children = [
      createLeaf(0, 0, 1 / 3, 1, "right", "Slide N Fold", glass, mesh),
      createLeaf(1 / 3, 0, 1 / 3, 1, "right", "Slide N Fold", glass, mesh),
      createLeaf(2 / 3, 0, 1 / 3, 1, "right", "Slide N Fold", glass, mesh),
    ];
    return root;
  }

  if (systemType === "Louvers") {
    root.description = "Louvers";
    root.glass = "Yes";
    root.mesh = "No";
    root.sash = "fixed";
    return root;
  }

  if (systemType === "Exhaust Fan") {
    root.description = "Exhaust Fan";
    root.hasExhaustFan = true;
    root.glass = "Yes";
    root.mesh = "No";
    root.sash = "fixed";
    return root;
  }

  root.sash = "double";
  return root;
};

const cloneTree = (node: SectionNode): SectionNode => JSON.parse(JSON.stringify(node)) as SectionNode;

const findParent = (node: SectionNode, id: string): SectionNode | null => {
  for (const child of node.children ?? []) {
    if (child.id === id) return node;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
};

const findNode = (node: SectionNode, id: string): SectionNode | null => {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
};

const mapLeafNodes = (node: SectionNode, cb: (leaf: SectionNode) => void) => {
  if (!node.children || node.children.length === 0) {
    cb(node);
    return;
  }
  node.children.forEach((child) => mapLeafNodes(child, cb));
};

const areAllDescriptionsFilled = (root: SectionNode) => {
  let isValid = true;
  mapLeafNodes(root, (leaf) => {
    if (!leaf.description || leaf.description.trim() === "") {
      isValid = false;
    }
  });
  return isValid;
};

const buildSplitChildren = (
  node: SectionNode,
  direction: SplitDirection,
  baseSystemType: SystemType,
  baseGlass: YesNo,
  baseMesh: YesNo,
  count: number,
  fractions?: number[]
): SectionNode[] => {
  const requestedCount = fractions?.length ?? count;
  const safeCount = Math.max(2, Math.min(requestedCount, 5));
  const normalizedFractions = fractions?.length
    ? (() => {
      const sliced = fractions.slice(0, safeCount);
      const sum = sliced.reduce((acc, v) => acc + v, 0) || 1;
      return sliced.map((v) => v / sum);
    })()
    : undefined;

  if (direction === "vertical") {
    let cursor = node.x;
    return Array.from({ length: safeCount }, (_, idx) => {
      const frac = normalizedFractions?.[idx] ?? 1 / safeCount;
      const childW = node.w * frac;
      const leaf = createLeaf(
        cursor,
        node.y,
        childW,
        node.h,
        idx === 0 ? node.sash : "fixed",
        idx === 0 ? node.systemType : baseSystemType,
        idx === 0 ? node.glass : baseGlass,
        idx === 0 ? node.mesh : baseMesh
      );
      cursor += childW;
      if (idx === 0) {
        leaf.series = node.series;
        leaf.description = node.description;
        leaf.hasExhaustFan = node.hasExhaustFan;
        leaf.exhaustFanX = node.exhaustFanX;
        leaf.exhaustFanY = node.exhaustFanY;
        leaf.exhaustFanSize = node.exhaustFanSize;
        leaf.panelFractions = node.panelFractions;
        leaf.panelMeshCount = node.panelMeshCount;
      }
      return leaf;
    });
  }

  let cursor = node.y;
  return Array.from({ length: safeCount }, (_, idx) => {
    const frac = normalizedFractions?.[idx] ?? 1 / safeCount;
    const childH = node.h * frac;
    const leaf = createLeaf(
      node.x,
      cursor,
      node.w,
      childH,
      idx === 0 ? node.sash : "fixed",
      idx === 0 ? node.systemType : baseSystemType,
      idx === 0 ? node.glass : baseGlass,
      idx === 0 ? node.mesh : baseMesh
    );
    cursor += childH;
    if (idx === 0) {
      leaf.series = node.series;
      leaf.description = node.description;
      leaf.hasExhaustFan = node.hasExhaustFan;
      leaf.exhaustFanX = node.exhaustFanX;
      leaf.exhaustFanY = node.exhaustFanY;
      leaf.exhaustFanSize = node.exhaustFanSize;
      leaf.panelFractions = node.panelFractions;
      leaf.panelMeshCount = node.panelMeshCount;
    }
    return leaf;
  });
};

const mmToSqft = (wMm: number, hMm: number) => {
  const wFt = wMm / 304.8;
  const hFt = hMm / 304.8;
  return Number((wFt * hFt).toFixed(2));
};

const normalizeSystemType = (value?: string): SystemType => {
  if (
    value === "Sliding" ||
    value === "Slide N Fold" ||
    value === "Casement" ||
    value === "Louvers" ||
    value === "Exhaust Fan"
  ) {
    return value;
  }
  return "Casement";
};

const yesNoFromValue = (value?: string | boolean): YesNo => {
  if (value === true || value === "Yes") return "Yes";
  if (typeof value === "string" && value.trim() !== "" && value !== "No") return "Yes";
  return "No";
};

const calculateRateForItem = (
  next: {
    area: number;
    description: string;
    colorFinish: string;
    glassSpec: string;
    handleType: string;
    handleColor: string;
    meshPresent: string;
    meshType: string;
  },
  descriptions: Description[] | undefined,
  options: OptionsResponse | undefined
) => {
  const desc = descriptions?.find((d) => d.name === next.description);
  const baseRates = desc?.baseRates ?? [];
  const slab = AREA_SLABS.find((s) => next.area <= s.max);
  const baseRate = baseRates[slab?.index ?? 0] ?? 0;
  const colorRate = options?.colorFinishes.find((c) => c.name === next.colorFinish)?.rate ?? 0;
  const meshRate =
    next.meshPresent === "Yes"
      ? options?.meshTypes.find((m) => m.name === next.meshType)?.rate ?? 0
      : 0;
  const glassRate = options?.glassSpecs.find((g) => g.name === next.glassSpec)?.rate ?? 0;
  const handleOpt = options?.handleOptions.find((h) => h.name === next.handleType);
  const handleCount = desc?.defaultHandleCount ?? 0;
  const handleUnitRate = handleOpt?.colors.find((c) => c.name === next.handleColor)?.rate ?? 0;
  const handleRate = handleCount > 0 ? (handleCount * handleUnitRate) / (next.area || 1) : 0;

  return {
    rate: baseRate + colorRate + meshRate + glassRate + handleRate,
    handleCount,
    baseRate,
    areaSlabIndex: slab?.index ?? 0,
  };
};

const mapItemToConfiguratorState = (item: QuotationItem) => {
  const width = Math.round(item.width || 1500);
  const height = Math.round(item.height || 1500);
  const subItems = item.subItems ?? [];
  const hasSubItems = item.systemType === COMBINATION_SYSTEM && subItems.length > 1;
  const sourceSystem = hasSubItems
    ? normalizeSystemType(subItems[0]?.systemType)
    : normalizeSystemType(item.systemType);

  const root = createRoot(sourceSystem);
  root.glass = yesNoFromValue(
    hasSubItems
      ? subItems.some((sub) => Boolean(sub.glassSpec && sub.glassSpec.trim()))
      : item.glassSpec
  );
  root.mesh = yesNoFromValue(hasSubItems ? subItems[0]?.meshPresent : item.meshPresent);

  const applySlidingPatternFromDescription = (node: SectionNode) => {
    if (node.systemType !== "Sliding") return;
    const pattern = parsePanelPattern(node.description || "");
    if (!pattern) {
      node.panelFractions = undefined;
      node.panelMeshCount = undefined;
      node.panelSashes = undefined;
      return;
    }
    node.panelFractions = pattern.fractions;
    node.panelMeshCount = pattern.meshCount;
    node.panelSashes =
      node.panelSashes && node.panelSashes.length === pattern.fractions.length
        ? node.panelSashes
        : buildDefaultSlidingPanelSashes(pattern.fractions.length);
    node.mesh = (pattern.meshCount ?? 0) > 0 ? "Yes" : node.mesh;
  };

  const normalizeLeafDescription = (systemType: SystemType, description: string, hasExhaustFan?: boolean) => {
    if (isLouverSystem(systemType)) return "Louvers";
    if (isExhaustSystem(systemType)) return "Exhaust Fan";
    if (hasExhaustFan && systemType === "Casement") return "Fix";
    return description;
  };

  if (hasSubItems) {
    const avgHeightMatch =
      subItems.reduce((sum, sub) => sum + ((sub.height || 0) / Math.max(height, 1)), 0) /
      subItems.length;
    const avgWidthMatch =
      subItems.reduce((sum, sub) => sum + ((sub.width || 0) / Math.max(width, 1)), 0) /
      subItems.length;
    const inferredDirection: SplitDirection =
      avgWidthMatch > avgHeightMatch ? "horizontal" : "vertical";

    const ordered = [...subItems];
    root.split = inferredDirection;

    if (inferredDirection === "vertical") {
      const totalWidth = ordered.reduce((sum, sub) => sum + (sub.width || 0), 0) || width;
      let cursor = 0;
      root.children = ordered.map((sub, idx) => {
        const childHasExhaustFan =
          Boolean(sub.hasExhaustFan) || sub.systemType === "Exhaust Fan" || (sub.description || "").includes("Exhaust Fan");
        const normalizedSystemType = normalizeSystemType(sub.systemType);
        const frac = (sub.width || width / ordered.length) / totalWidth;
        const safeFrac = Number.isFinite(frac) && frac > 0 ? frac : 1 / ordered.length;
        const child = createLeaf(
          cursor,
          0,
          safeFrac,
          1,
          sub.systemType === "Sliding"
            ? ((sub.sash as SashType | undefined) ?? (idx % 2 === 0 ? "left" : "right"))
            : "fixed",
          normalizedSystemType,
          normalizedSystemType === "Exhaust Fan" ? "Yes" : yesNoFromValue(sub.glassSpec),
          yesNoFromValue(sub.meshPresent)
        );
        child.series = sub.series || "";
        child.hasExhaustFan = childHasExhaustFan;
        child.exhaustFanX = typeof sub.exhaustFanX === "number" ? sub.exhaustFanX : DEFAULT_EXHAUST_FAN_X;
        child.exhaustFanY = typeof sub.exhaustFanY === "number" ? sub.exhaustFanY : DEFAULT_EXHAUST_FAN_Y;
        child.exhaustFanSize = typeof sub.exhaustFanSize === "number" ? sub.exhaustFanSize : DEFAULT_EXHAUST_FAN_SIZE;
        child.description = normalizeLeafDescription(normalizedSystemType, sub.description || "", childHasExhaustFan);
        child.panelSashes =
          sub.panelSashes?.filter((value): value is SashType =>
            value === "fixed" || value === "left" || value === "right" || value === "double" || value === "top" || value === "bottom"
          ) ?? undefined;
        applySlidingPatternFromDescription(child);
        cursor += safeFrac;
        return child;
      });

      const sum = root.children.reduce((acc, child) => acc + child.w, 0) || 1;
      let normalizedCursor = 0;
      root.children.forEach((child, idx) => {
        const w = child.w / sum;
        child.w = w;
        child.x = normalizedCursor;
        if (idx === root.children!.length - 1) {
          child.w = 1 - normalizedCursor;
        }
        normalizedCursor += child.w;
      });
    } else {
      const totalHeight = ordered.reduce((sum, sub) => sum + (sub.height || 0), 0) || height;
      let cursor = 0;
      root.children = ordered.map((sub, idx) => {
        const childHasExhaustFan =
          Boolean(sub.hasExhaustFan) || sub.systemType === "Exhaust Fan" || (sub.description || "").includes("Exhaust Fan");
        const normalizedSystemType = normalizeSystemType(sub.systemType);
        const frac = (sub.height || height / ordered.length) / totalHeight;
        const safeFrac = Number.isFinite(frac) && frac > 0 ? frac : 1 / ordered.length;
        const child = createLeaf(
          0,
          cursor,
          1,
          safeFrac,
          sub.systemType === "Sliding"
            ? ((sub.sash as SashType | undefined) ?? (idx % 2 === 0 ? "left" : "right"))
            : "fixed",
          normalizedSystemType,
          normalizedSystemType === "Exhaust Fan" ? "Yes" : yesNoFromValue(sub.glassSpec),
          yesNoFromValue(sub.meshPresent)
        );
        child.series = sub.series || "";
        child.hasExhaustFan = childHasExhaustFan;
        child.exhaustFanX = typeof sub.exhaustFanX === "number" ? sub.exhaustFanX : DEFAULT_EXHAUST_FAN_X;
        child.exhaustFanY = typeof sub.exhaustFanY === "number" ? sub.exhaustFanY : DEFAULT_EXHAUST_FAN_Y;
        child.exhaustFanSize = typeof sub.exhaustFanSize === "number" ? sub.exhaustFanSize : DEFAULT_EXHAUST_FAN_SIZE;
        child.description = normalizeLeafDescription(normalizedSystemType, sub.description || "", childHasExhaustFan);
        child.panelSashes =
          sub.panelSashes?.filter((value): value is SashType =>
            value === "fixed" || value === "left" || value === "right" || value === "double" || value === "top" || value === "bottom"
          ) ?? undefined;
        applySlidingPatternFromDescription(child);
        cursor += safeFrac;
        return child;
      });

      const sum = root.children.reduce((acc, child) => acc + child.h, 0) || 1;
      let normalizedCursor = 0;
      root.children.forEach((child, idx) => {
        const h = child.h / sum;
        child.h = h;
        child.y = normalizedCursor;
        if (idx === root.children!.length - 1) {
          child.h = 1 - normalizedCursor;
        }
        normalizedCursor += child.h;
      });
    }
  } else {
    root.systemType = sourceSystem;
    root.series = item.series || "";
    root.hasExhaustFan =
      Boolean(item.hasExhaustFan) || item.systemType === "Exhaust Fan" || (item.description || "").includes("Exhaust Fan");
    root.exhaustFanX = typeof item.exhaustFanX === "number" ? item.exhaustFanX : DEFAULT_EXHAUST_FAN_X;
    root.exhaustFanY = typeof item.exhaustFanY === "number" ? item.exhaustFanY : DEFAULT_EXHAUST_FAN_Y;
    root.exhaustFanSize = typeof item.exhaustFanSize === "number" ? item.exhaustFanSize : DEFAULT_EXHAUST_FAN_SIZE;
    root.description = normalizeLeafDescription(sourceSystem, item.description || "", root.hasExhaustFan);
    root.glass = sourceSystem === "Exhaust Fan" ? "Yes" : yesNoFromValue(item.glassSpec);
    root.mesh = yesNoFromValue(item.meshPresent);
    root.sash =
      item.sash === "fixed" ||
        item.sash === "left" ||
        item.sash === "right" ||
        item.sash === "double" ||
        item.sash === "top" ||
        item.sash === "bottom"
        ? item.sash
        : root.sash;
    root.panelSashes =
      item.panelSashes?.filter((value): value is SashType =>
        value === "fixed" || value === "left" || value === "right" || value === "double" || value === "top" || value === "bottom"
      ) ?? undefined;
    applySlidingPatternFromDescription(root);
  }

  const meta: ProductMeta = {
    productType: item.height > 2200 ? "Door" : "Window",
    systemType: item.systemType || sourceSystem,
    series: item.series || "",
    description: item.description || "",
    colorFinish: item.colorFinish || "",
    glassSpec: item.glassSpec || "",
    handleType: item.handleType || "",
    handleColor: item.handleColor || "",
    meshPresent: item.meshPresent || "No",
    meshType: item.meshType || "",
    location: item.location || item.projectLocation || "",
    quantity: item.quantity || 1,
    refCode: item.refCode || "",
    remarks: item.remarks || item.specialNotes || "",
    rate: item.rate || 0,
  };

  return {
    width,
    height,
    root,
    baseSystemType: sourceSystem,
    baseGlass: root.glass,
    baseMesh: root.mesh,
    meta,
  };
};

const drawSashGlyph = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number,
  type: SashType,
  color: string
) => {
  const inset = Math.min(w, h) * 0.18;
  const left = x + inset;
  const right = x + w - inset;
  const top = y + inset;
  const bottom = y + h - inset;
  const midX = x + w / 2;
  const midY = y + h / 2;

  if (type === "double") {
    group.add(new Konva.Line({ points: [left, top, midX, midY, left, bottom], stroke: color, strokeWidth: 2, listening: false }));
    group.add(new Konva.Line({ points: [right, top, midX, midY, right, bottom], stroke: color, strokeWidth: 2, listening: false }));
  } else if (type === "left") {
    group.add(new Konva.Line({ points: [left, top, right, midY, left, bottom], stroke: color, strokeWidth: 2, listening: false }));
  } else if (type === "right") {
    group.add(new Konva.Line({ points: [right, top, left, midY, right, bottom], stroke: color, strokeWidth: 2, listening: false }));
  } else if (type === "top") {
    group.add(new Konva.Line({ points: [left, top, midX, bottom, right, top], stroke: color, strokeWidth: 2, listening: false }));
  } else if (type === "bottom") {
    group.add(new Konva.Line({ points: [left, bottom, midX, top, right, bottom], stroke: color, strokeWidth: 2, listening: false }));
  }
};

const drawCasementSwingGuide = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number,
  side: "left" | "right"
) => {
  const pad = Math.min(w, h) * 0.08;
  const yTop = y + pad;
  const yBottom = y + h - pad;
  const pivotX = side === "left" ? x + w - pad : x + pad;
  const pivotY = y + h / 2;
  const startX = side === "left" ? x + pad : x + w - pad;

  const arrowStyle = {
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    dash: [12, 10],
    lineCap: "round" as const,
    lineJoin: "round" as const,
    pointerLength: 12,
    pointerWidth: 12,
    opacity: 0.95,
    listening: false,
  };

  group.add(
    new Konva.Arrow({
      points: [startX, yTop, pivotX, pivotY],
      ...arrowStyle,
    })
  );

  group.add(
    new Konva.Arrow({
      points: [startX, yBottom, pivotX, pivotY],
      ...arrowStyle,
    })
  );

  const handleW = Math.max(10, Math.min(18, w * 0.08));
  const handleH = Math.max(36, Math.min(58, h * 0.26));
  const hx = side === "left" ? x + w - handleW * 0.35 : x - handleW * 0.65;
  const hy = y + h / 2 - handleH / 2;

  group.add(
    new Konva.Rect({
      x: hx,
      y: hy,
      width: handleW,
      height: handleH,
      fill: "#111111",
      listening: false,
    })
  );
};

const drawTiltTurnGuide = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const pad = Math.min(w, h) * 0.05;
  const pivotX = x + w * 0.24;
  const pivotY = y + h * 0.50;
  const topMidX = x + w * 0.48;
  const topMidY = y + pad;
  const topRightX = x + w - pad;
  const topRightY = y + pad;
  const bottomRightX = x + w - pad;
  const bottomRightY = y + h - pad;
  const bottomLeftX = x + pad;
  const bottomLeftY = y + h - pad;

  const arrowStyle = {
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    dash: [12, 10],
    lineCap: "round" as const,
    lineJoin: "round" as const,
    pointerLength: 11,
    pointerWidth: 11,
    opacity: 0.95,
    listening: false,
  };

  group.add(new Konva.Arrow({ points: [pivotX, pivotY, topRightX, topRightY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [pivotX, pivotY, bottomRightX, bottomRightY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [bottomLeftX, bottomLeftY, topMidX, topMidY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [topMidX, topMidY, bottomRightX, bottomRightY], ...arrowStyle }));

  const hx = x - Math.max(10, w * 0.05);
  const hy = y + h * 0.52;
  const handleLen = Math.max(24, Math.min(38, h * 0.16));
  const handleOut = Math.max(16, Math.min(28, w * 0.12));
  group.add(
    new Konva.Line({
      points: [hx, hy + handleLen * 0.45, hx, hy, hx + handleOut, hy],
      stroke: "#111111",
      strokeWidth: 10,
      lineCap: "round",
      lineJoin: "round",
      listening: false,
    })
  );
};

const drawTopHungGuide = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const pad = Math.min(w, h) * 0.05;
  const pivotX = x + w / 2;
  const pivotY = y + h - pad;
  const leftTopX = x + pad;
  const leftTopY = y + pad;
  const rightTopX = x + w - pad;
  const rightTopY = y + pad;

  const arrowStyle = {
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    dash: [12, 10],
    lineCap: "round" as const,
    lineJoin: "round" as const,
    pointerLength: 11,
    pointerWidth: 11,
    opacity: 0.95,
    listening: false,
  };

  group.add(new Konva.Arrow({ points: [pivotX, pivotY, leftTopX, leftTopY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [pivotX, pivotY, rightTopX, rightTopY], ...arrowStyle }));

  const baseW = Math.max(36, Math.min(72, w * 0.28));
  const baseH = Math.max(12, Math.min(22, h * 0.08));
  const stemW = Math.max(20, Math.min(36, w * 0.14));
  const stemH = Math.max(18, Math.min(32, h * 0.12));
  group.add(
    new Konva.Rect({
      x: pivotX - baseW / 2,
      y: y + h - baseH - 2,
      width: baseW,
      height: baseH,
      fill: "#111111",
      listening: false,
    })
  );
  group.add(
    new Konva.Rect({
      x: pivotX - stemW / 2,
      y: y + h - stemH + 2,
      width: stemW,
      height: stemH,
      fill: "#111111",
      listening: false,
    })
  );
};

const drawBottomHungGuide = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const pad = Math.min(w, h) * 0.05;
  const pivotX = x + w / 2;
  const pivotY = y + pad;
  const leftBottomX = x + pad;
  const leftBottomY = y + h - pad;
  const rightBottomX = x + w - pad;
  const rightBottomY = y + h - pad;

  const arrowStyle = {
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    dash: [12, 10],
    lineCap: "round" as const,
    lineJoin: "round" as const,
    pointerLength: 11,
    pointerWidth: 11,
    opacity: 0.95,
    listening: false,
  };

  group.add(new Konva.Arrow({ points: [pivotX, pivotY, leftBottomX, leftBottomY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [pivotX, pivotY, rightBottomX, rightBottomY], ...arrowStyle }));

  const baseW = Math.max(36, Math.min(72, w * 0.28));
  const baseH = Math.max(12, Math.min(22, h * 0.08));
  const stemW = Math.max(20, Math.min(36, w * 0.14));
  const stemH = Math.max(18, Math.min(32, h * 0.12));
  group.add(
    new Konva.Rect({
      x: pivotX - baseW / 2,
      y: y + 2,
      width: baseW,
      height: baseH,
      fill: "#111111",
      listening: false,
    })
  );
  group.add(
    new Konva.Rect({
      x: pivotX - stemW / 2,
      y: y + baseH - 2,
      width: stemW,
      height: stemH,
      fill: "#111111",
      listening: false,
    })
  );
};

const drawFrenchGuide = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const pad = Math.min(w, h) * 0.04;
  const centerGap = Math.max(10, Math.min(22, w * 0.05));
  const leafW = (w - centerGap) / 2;
  const leftX = x;
  const rightX = x + leafW + centerGap;
  const borderW = Math.max(4, Math.min(8, w * 0.02));

  group.add(
    new Konva.Rect({
      x: leftX,
      y,
      width: leafW,
      height: h,
      stroke: "#111111",
      strokeWidth: borderW,
      listening: false,
    })
  );
  group.add(
    new Konva.Rect({
      x: rightX,
      y,
      width: leafW,
      height: h,
      stroke: "#111111",
      strokeWidth: borderW,
      listening: false,
    })
  );

  group.add(
    new Konva.Rect({
      x: x + (w - centerGap) / 2,
      y,
      width: centerGap,
      height: h,
      fill: "#1F2937",
      opacity: 0.95,
      listening: false,
    })
  );

  const arrowStyle = {
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    dash: [12, 10],
    lineCap: "round" as const,
    lineJoin: "round" as const,
    pointerLength: 10,
    pointerWidth: 10,
    opacity: 0.95,
    listening: false,
  };

  const leftPivotX = leftX + leafW - pad;
  const leftPivotY = y + h / 2;
  group.add(new Konva.Arrow({ points: [leftX + pad, y + pad, leftPivotX, leftPivotY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [leftX + pad, y + h - pad, leftPivotX, leftPivotY], ...arrowStyle }));

  const rightPivotX = rightX + pad;
  const rightPivotY = y + h / 2;
  group.add(new Konva.Arrow({ points: [rightX + leafW - pad, y + pad, rightPivotX, rightPivotY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [rightX + leafW - pad, y + h - pad, rightPivotX, rightPivotY], ...arrowStyle }));

  const handleBaseW = Math.max(16, Math.min(30, w * 0.1));
  const handleBaseH = Math.max(28, Math.min(52, h * 0.2));
  const handleTallW = Math.max(14, Math.min(26, w * 0.085));
  const handleTallH = Math.max(46, Math.min(78, h * 0.3));
  const midY = y + h * 0.52;
  const centerX = x + w / 2;

  group.add(
    new Konva.Rect({
      x: centerX - handleBaseW,
      y: midY - handleBaseH / 2,
      width: handleBaseW,
      height: handleBaseH,
      fill: "#111111",
      listening: false,
    })
  );
  group.add(
    new Konva.Rect({
      x: centerX + 2,
      y: midY - handleTallH / 2,
      width: handleTallW,
      height: handleTallH,
      fill: "#111111",
      listening: false,
    })
  );
};

const drawSlideNFoldTwoPanelGuide = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const pad = Math.min(w, h) * 0.05;
  const cx = x + w / 2;
  const cy = y + h * 0.68;
  const topY = y + pad;
  const bottomY = y + h - pad;
  const leftX = x + pad;
  const rightX = x + w - pad;

  const arrowStyle = {
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    dash: [12, 10],
    lineCap: "round" as const,
    lineJoin: "round" as const,
    pointerLength: 10,
    pointerWidth: 10,
    opacity: 0.95,
    listening: false,
  };

  group.add(new Konva.Arrow({ points: [leftX, topY, cx, cy], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [leftX, bottomY, cx, cy], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [rightX, topY, cx, cy], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [rightX, bottomY, cx, cy], ...arrowStyle }));

  const solidStroke = 3.5;
  const topInnerY = y + h * 0.20;
  const outY = y + h - Math.max(10, h * 0.12);

  group.add(new Konva.Line({ points: [leftX, topY, cx - w * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rightX, topY, cx + w * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [cx - w * 0.07, topInnerY, cx - w * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [cx + w * 0.07, topInnerY, cx + w * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));

  const barW = Math.max(20, Math.min(34, w * 0.14));
  const barH = Math.max(8, Math.min(14, h * 0.05));
  group.add(
    new Konva.Rect({
      x: cx - barW / 2,
      y: cy - barH / 2,
      width: barW,
      height: barH,
      fill: "#111111",
      listening: false,
    })
  );

  group.add(new Konva.Line({ points: [leftX, bottomY, cx - w * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rightX, bottomY, cx + w * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [leftX, bottomY, cx - w * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rightX, bottomY, cx + w * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [cx - w * 0.07, topInnerY, cx - w * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [cx + w * 0.07, topInnerY, cx + w * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));

  const lockW = Math.max(12, Math.min(22, w * 0.08));
  const lockH = Math.max(36, Math.min(56, h * 0.22));
  group.add(
    new Konva.Rect({
      x: x + w - lockW - pad * 0.35,
      y: y + h * 0.52 - lockH / 2,
      width: lockW,
      height: lockH,
      fill: "#111111",
      listening: false,
    })
  );
};

// Remaining helpers and component body continue exactly in the same working flow,
// adapted only for the local repo types and imports.

const drawSlideNFoldThreePanelOnePlusTwoGuide = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const pad = Math.min(w, h) * 0.05;
  const leftX = x + pad;
  const rightX = x + w - pad;
  const topY = y + pad;
  const bottomY = y + h - pad;
  const p1x = x + w / 3;
  const p2x = x + (2 * w) / 3;
  const pY = y + h * 0.68;
  const topInnerY = y + h * 0.22;
  const outY = y + h - Math.max(10, h * 0.12);

  const arrowStyle = {
    stroke: "#111111",
    fill: "#111111",
    strokeWidth: 2,
    dash: [12, 10],
    lineCap: "round" as const,
    lineJoin: "round" as const,
    pointerLength: 10,
    pointerWidth: 10,
    opacity: 0.95,
    listening: false,
  };

  group.add(new Konva.Arrow({ points: [leftX, topY, p1x, pY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [leftX, bottomY, p1x, pY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [p2x, topY, p1x, pY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [p2x, bottomY, p1x, pY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [p2x + pad, topY, rightX, pY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [p2x + pad, bottomY, rightX, pY], ...arrowStyle }));

  const solidStroke = 3.5;
  group.add(new Konva.Line({ points: [leftX, topY, p1x - w * 0.05, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p2x, topY, p1x + w * 0.05, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p2x + pad, topY, rightX - w * 0.04, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p1x - w * 0.05, topInnerY, p1x - w * 0.05, pY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p1x + w * 0.05, topInnerY, p1x + w * 0.05, pY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p2x + w * 0.01, topInnerY, p2x + w * 0.01, pY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));

  const barW = Math.max(18, Math.min(30, w * 0.10));
  const barH = Math.max(8, Math.min(14, h * 0.05));
  group.add(new Konva.Rect({ x: p1x - barW / 2, y: pY - barH / 2, width: barW, height: barH, fill: "#111111", listening: false }));
  group.add(new Konva.Rect({ x: p2x - barW / 2, y: pY - barH / 2, width: barW, height: barH, fill: "#111111", listening: false }));

  const stemW = Math.max(8, Math.min(14, w * 0.03));
  group.add(new Konva.Rect({ x: p1x - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  group.add(new Konva.Rect({ x: p2x - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));

  group.add(new Konva.Line({ points: [leftX, bottomY, p1x - w * 0.05, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [leftX, bottomY, p1x + w * 0.05, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p2x, bottomY, p1x + w * 0.05, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p2x, bottomY, p1x - w * 0.05, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p1x - w * 0.05, topInnerY, p1x - w * 0.05, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p1x + w * 0.05, topInnerY, p1x + w * 0.05, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p2x + pad, bottomY, rightX - w * 0.04, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [p2x + pad, bottomY, rightX, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rightX, bottomY, rightX - w * 0.04, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));

  const lockW = Math.max(12, Math.min(22, w * 0.07));
  const lockH = Math.max(34, Math.min(52, h * 0.2));
  group.add(
    new Konva.Rect({
      x: x + w - lockW - pad * 0.35,
      y: y + h * 0.52 - lockH / 2,
      width: lockW,
      height: lockH,
      fill: "#111111",
      listening: false,
    })
  );
};

const drawSlideNFoldFourPanelOnePlusThreeGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
  const pad = Math.min(w, h) * 0.05;
  const splitGap = Math.max(8, Math.min(16, w * 0.02));
  const halfW = (w - splitGap) / 2;
  const leftBaseX = x;
  const rightBaseX = x + halfW + splitGap;
  const topY = y + pad;
  const bottomY = y + h - pad;
  const outY = y + h - Math.max(10, h * 0.12);
  const solidStroke = 3.5;
  const arrowStyle = { stroke: "#111111", fill: "#111111", strokeWidth: 2, dash: [12, 10], lineCap: "round" as const, lineJoin: "round" as const, pointerLength: 10, pointerWidth: 10, opacity: 0.95, listening: false };

  const drawPair = (baseX: number) => {
    const leftX = baseX + pad;
    const rightX = baseX + halfW - pad;
    const cx = baseX + halfW / 2;
    const cy = y + h * 0.68;
    const topInnerY = y + h * 0.22;
    group.add(new Konva.Arrow({ points: [leftX, topY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [leftX, bottomY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [rightX, topY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [rightX, bottomY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Line({ points: [leftX, topY, cx - halfW * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, topY, cx + halfW * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx - halfW * 0.07, topInnerY, cx - halfW * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx + halfW * 0.07, topInnerY, cx + halfW * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    const barW = Math.max(14, Math.min(24, halfW * 0.14));
    const barH = Math.max(8, Math.min(14, h * 0.05));
    group.add(new Konva.Rect({ x: cx - barW / 2, y: cy - barH / 2, width: barW, height: barH, fill: "#111111", listening: false }));
    group.add(new Konva.Line({ points: [leftX, bottomY, cx - halfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, bottomY, cx + halfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [leftX, bottomY, cx - halfW * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, bottomY, cx + halfW * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx - halfW * 0.07, topInnerY, cx - halfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx + halfW * 0.07, topInnerY, cx + halfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    const stemW = Math.max(8, Math.min(14, halfW * 0.05));
    group.add(new Konva.Rect({ x: cx - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  };

  drawPair(leftBaseX);
  drawPair(rightBaseX);
  const midBarW = Math.max(10, Math.min(16, w * 0.02));
  const topInnerY = y + h * 0.22;
  group.add(new Konva.Rect({ x: x + halfW + splitGap / 2 - midBarW / 2, y: topInnerY, width: midBarW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  const lockW = Math.max(12, Math.min(22, w * 0.05));
  const lockH = Math.max(34, Math.min(52, h * 0.2));
  group.add(new Konva.Rect({ x: x + w - lockW - pad * 0.35, y: y + h * 0.52 - lockH / 2, width: lockW, height: lockH, fill: "#111111", listening: false }));
};

const drawSlideNFoldFivePanelOnePlusFourGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
  const pad = Math.min(w, h) * 0.05;
  const splitGap = Math.max(8, Math.min(14, w * 0.018));
  const twoPairW = w * 0.8;
  const singleW = w - twoPairW - splitGap;
  const pairHalfW = (twoPairW - splitGap) / 2;
  const leftBaseX = x;
  const midBaseX = x + pairHalfW + splitGap;
  const rightBaseX = x + twoPairW + splitGap;
  const topY = y + pad;
  const bottomY = y + h - pad;
  const outY = y + h - Math.max(10, h * 0.12);
  const solidStroke = 3.5;
  const arrowStyle = { stroke: "#111111", fill: "#111111", strokeWidth: 2, dash: [12, 10], lineCap: "round" as const, lineJoin: "round" as const, pointerLength: 10, pointerWidth: 10, opacity: 0.95, listening: false };

  const drawPair = (baseX: number) => {
    const leftX = baseX + pad;
    const rightX = baseX + pairHalfW - pad;
    const cx = baseX + pairHalfW / 2;
    const cy = y + h * 0.68;
    const topInnerY = y + h * 0.22;
    group.add(new Konva.Arrow({ points: [leftX, topY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [leftX, bottomY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [rightX, topY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [rightX, bottomY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Line({ points: [leftX, topY, cx - pairHalfW * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, topY, cx + pairHalfW * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx - pairHalfW * 0.07, topInnerY, cx - pairHalfW * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx + pairHalfW * 0.07, topInnerY, cx + pairHalfW * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    const barW = Math.max(14, Math.min(24, pairHalfW * 0.14));
    const barH = Math.max(8, Math.min(14, h * 0.05));
    group.add(new Konva.Rect({ x: cx - barW / 2, y: cy - barH / 2, width: barW, height: barH, fill: "#111111", listening: false }));
    group.add(new Konva.Line({ points: [leftX, bottomY, cx - pairHalfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, bottomY, cx + pairHalfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [leftX, bottomY, cx - pairHalfW * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, bottomY, cx + pairHalfW * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx - pairHalfW * 0.07, topInnerY, cx - pairHalfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx + pairHalfW * 0.07, topInnerY, cx + pairHalfW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    const stemW = Math.max(8, Math.min(14, pairHalfW * 0.05));
    group.add(new Konva.Rect({ x: cx - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  };

  drawPair(leftBaseX);
  drawPair(midBaseX);
  const rLeftX = rightBaseX + pad * 0.7;
  const rRightX = x + w - pad;
  const rPivotX = rRightX;
  const rPivotY = y + h * 0.68;
  const rTopInnerY = y + h * 0.22;
  group.add(new Konva.Arrow({ points: [rLeftX, topY, rPivotX, rPivotY], ...arrowStyle }));
  group.add(new Konva.Arrow({ points: [rLeftX, bottomY, rPivotX, rPivotY], ...arrowStyle }));
  group.add(new Konva.Line({ points: [rLeftX, topY, rRightX - singleW * 0.08, rTopInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rRightX - singleW * 0.08, rTopInnerY, rRightX - singleW * 0.08, rPivotY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rLeftX, bottomY, rRightX - singleW * 0.08, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rLeftX, bottomY, rRightX, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  group.add(new Konva.Line({ points: [rRightX, bottomY, rRightX - singleW * 0.08, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
  const stemW = Math.max(8, Math.min(12, w * 0.018));
  const topInnerY = y + h * 0.22;
  const dividerX1 = x + pairHalfW + splitGap / 2;
  const dividerX2 = x + twoPairW + splitGap / 2;
  group.add(new Konva.Rect({ x: dividerX1 - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  group.add(new Konva.Rect({ x: dividerX2 - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  const lockW = Math.max(12, Math.min(20, w * 0.045));
  const lockH = Math.max(34, Math.min(52, h * 0.2));
  group.add(new Konva.Rect({ x: x + w - lockW - pad * 0.35, y: y + h * 0.52 - lockH / 2, width: lockW, height: lockH, fill: "#111111", listening: false }));
};

const drawSlideNFoldSixPanelOnePlusFiveGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
  const pad = Math.min(w, h) * 0.05;
  const pairGap = Math.max(8, Math.min(14, w * 0.016));
  const pairW = (w - pairGap * 2) / 3;
  const topY = y + pad;
  const bottomY = y + h - pad;
  const outY = y + h - Math.max(10, h * 0.12);
  const solidStroke = 3.5;
  const arrowStyle = { stroke: "#111111", fill: "#111111", strokeWidth: 2, dash: [12, 10], lineCap: "round" as const, lineJoin: "round" as const, pointerLength: 10, pointerWidth: 10, opacity: 0.95, listening: false };

  const drawPair = (baseX: number) => {
    const leftX = baseX + pad;
    const rightX = baseX + pairW - pad;
    const cx = baseX + pairW / 2;
    const cy = y + h * 0.68;
    const topInnerY = y + h * 0.22;
    group.add(new Konva.Arrow({ points: [leftX, topY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [leftX, bottomY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [rightX, topY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Arrow({ points: [rightX, bottomY, cx, cy], ...arrowStyle }));
    group.add(new Konva.Line({ points: [leftX, topY, cx - pairW * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, topY, cx + pairW * 0.07, topInnerY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx - pairW * 0.07, topInnerY, cx - pairW * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx + pairW * 0.07, topInnerY, cx + pairW * 0.07, cy], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    const barW = Math.max(14, Math.min(24, pairW * 0.14));
    const barH = Math.max(8, Math.min(14, h * 0.05));
    group.add(new Konva.Rect({ x: cx - barW / 2, y: cy - barH / 2, width: barW, height: barH, fill: "#111111", listening: false }));
    group.add(new Konva.Line({ points: [leftX, bottomY, cx - pairW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, bottomY, cx + pairW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [leftX, bottomY, cx - pairW * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [rightX, bottomY, cx + pairW * 0.07, bottomY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx - pairW * 0.07, topInnerY, cx - pairW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    group.add(new Konva.Line({ points: [cx + pairW * 0.07, topInnerY, cx + pairW * 0.07, outY], stroke: "#111111", strokeWidth: solidStroke, listening: false }));
    const stemW = Math.max(8, Math.min(14, pairW * 0.05));
    group.add(new Konva.Rect({ x: cx - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  };

  const base1 = x;
  const base2 = x + pairW + pairGap;
  const base3 = x + (pairW + pairGap) * 2;
  drawPair(base1);
  drawPair(base2);
  drawPair(base3);

  const stemW = Math.max(8, Math.min(12, w * 0.016));
  const topInnerY = y + h * 0.22;
  const dividerX1 = x + pairW + pairGap / 2;
  const dividerX2 = x + pairW * 2 + pairGap * 1.5;
  group.add(new Konva.Rect({ x: dividerX1 - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  group.add(new Konva.Rect({ x: dividerX2 - stemW / 2, y: topInnerY, width: stemW, height: bottomY - topInnerY, fill: "#111111", listening: false, opacity: 0.9 }));
  const lockW = Math.max(12, Math.min(20, w * 0.04));
  const lockH = Math.max(34, Math.min(52, h * 0.2));
  group.add(new Konva.Rect({ x: x + w - lockW - pad * 0.35, y: y + h * 0.52 - lockH / 2, width: lockW, height: lockH, fill: "#111111", listening: false }));
};

const drawLouversGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
  const slatCount = Math.max(5, Math.min(8, Math.floor(h / 42)));
  const gap = h / (slatCount + 1);
  for (let idx = 0; idx < slatCount; idx += 1) {
    const topY = y + gap * (idx + 0.6);
    const bottomY = topY + Math.max(10, gap * 0.34);
    group.add(new Konva.Line({ points: [x + w * 0.06, topY, x + w * 0.94, topY], stroke: "#0F172A", strokeWidth: 2.2, listening: false }));
    group.add(new Konva.Line({ points: [x + w * 0.12, bottomY, x + w * 0.94, topY], stroke: "#0F172A", strokeWidth: 2.2, listening: false }));
  }
};

const getExhaustFanGeometry = (x: number, y: number, w: number, h: number, centerXRatio = DEFAULT_EXHAUST_FAN_X, centerYRatio = DEFAULT_EXHAUST_FAN_Y, sizeRatio = DEFAULT_EXHAUST_FAN_SIZE) => {
  const fanSize = clampValue(sizeRatio, 0.2, 0.9);
  const centerX = x + w * clampValue(centerXRatio, 0.18, 0.82);
  const centerY = y + h * clampValue(centerYRatio, 0.18, 0.82);
  const radius = Math.min(w, h) * fanSize * 0.5;
  const outerRadius = radius * 1.18;
  return { centerX, centerY, radius, outerRadius, diameter: outerRadius * 2 };
};

const drawExhaustFanGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number, centerXRatio = DEFAULT_EXHAUST_FAN_X, centerYRatio = DEFAULT_EXHAUST_FAN_Y, sizeRatio = DEFAULT_EXHAUST_FAN_SIZE) => {
  const { centerX, centerY, radius, outerRadius } = getExhaustFanGeometry(x, y, w, h, centerXRatio, centerYRatio, sizeRatio);
  group.add(new Konva.Circle({ x: centerX, y: centerY, radius: outerRadius, stroke: "#111111", strokeWidth: 3, listening: false }));
  group.add(new Konva.Circle({ x: centerX, y: centerY, radius: radius * 0.32, fill: "#FFFFFF", stroke: "#111111", strokeWidth: 2, listening: false }));
  for (let idx = 0; idx < 4; idx += 1) {
    const startAngle = (-90 + idx * 90) * (Math.PI / 180);
    const endAngle = startAngle + Math.PI / 3;
    const bladePoints = [
      centerX + Math.cos(startAngle) * (radius * 0.42),
      centerY + Math.sin(startAngle) * (radius * 0.42),
      centerX + Math.cos(endAngle - 0.18) * radius,
      centerY + Math.sin(endAngle - 0.18) * radius,
      centerX + Math.cos(endAngle) * (radius * 0.54),
      centerY + Math.sin(endAngle) * (radius * 0.54),
    ];
    group.add(new Konva.Line({ points: bladePoints, closed: true, fill: "#FFFFFF", stroke: "#111111", strokeWidth: 2, listening: false }));
  }
  group.add(new Konva.Line({ points: [centerX, y + h * 0.1, centerX, y + h * 0.36], stroke: "#111111", strokeWidth: 1.5, listening: false, opacity: 0.45 }));
};

const parsePanelPattern = (desc: string): { fractions: number[]; meshCount?: number } | null => {
  const panelGroup = desc.match(/(\d+)\s*Panel\s*\((\d+)\+(\d+)\)/i);
  if (panelGroup) {
    const left = Number(panelGroup[2]);
    const right = Number(panelGroup[3]);
    const total = left + right;
    return { fractions: [left / total, right / total] };
  }
  const panelCount = desc.match(/^(\d+)\s*Panel/i);
  if (panelCount) {
    const count = Number(panelCount[1]);
    return { fractions: Array.from({ length: count }, () => 1 / count) };
  }
  const trackPanels = desc.match(/(\d+)\s*Track\s+(\d+)\s*Glass/i);
  if (trackPanels) {
    const count = Number(trackPanels[2]);
    const meshMatch = desc.match(/(\d+)\s*Mesh/i);
    return { fractions: Array.from({ length: count }, () => 1 / count), meshCount: meshMatch ? Number(meshMatch[1]) : 0 };
  }
  const glassMeshCombo = desc.match(/(\d+)\s*Glass.*(\d+)\s*Mesh/i);
  if (glassMeshCombo) {
    const glass = Number(glassMeshCombo[1]);
    const mesh = Number(glassMeshCombo[2]);
    const total = glass + mesh;
    return { fractions: Array.from({ length: total }, () => 1 / total), meshCount: mesh };
  }
  return null;
};

const isSlideNFoldTwoPanelOnePlusOne = (desc: string) => /^2\s*Panel\s*\(\s*1\s*\+\s*1\s*\)$/i.test(desc);
const isSlideNFoldThreePanelOnePlusTwo = (desc: string) => /^3\s*Panel\s*\(\s*1\s*\+\s*2\s*\)$/i.test(desc);
const isSlideNFoldFourPanelOnePlusThree = (desc: string) => /^4\s*Panel\s*\(\s*1\s*\+\s*3\s*\)$/i.test(desc);
const isSlideNFoldFivePanelOnePlusFour = (desc: string) => /^5\s*Panel\s*\(\s*1\s*\+\s*4\s*\)$/i.test(desc);
const isSlideNFoldSixPanelOnePlusFive = (desc: string) => /^6\s*Panel\s*\(\s*1\s*\+\s*5\s*\)$/i.test(desc);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const useHistory = (initial: SectionNode) => {
  const [past, setPast] = useState<SectionNode[]>([]);
  const [present, setPresent] = useState<SectionNode>(initial);
  const [future, setFuture] = useState<SectionNode[]>([]);

  const push = useCallback((next: SectionNode) => {
    setPast((prev) => [...prev, cloneTree(present)]);
    setPresent(cloneTree(next));
    setFuture([]);
  }, [present]);

  const setDirect = useCallback((next: SectionNode) => {
    setPresent(cloneTree(next));
  }, []);

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      setFuture((f) => [cloneTree(present), ...f]);
      const next = prev[prev.length - 1];
      setPresent(cloneTree(next));
      return prev.slice(0, -1);
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      setPast((p) => [...p, cloneTree(present)]);
      const next = prev[0];
      setPresent(cloneTree(next));
      return prev.slice(1);
    });
  }, [present]);

  const reset = useCallback((node: SectionNode) => {
    setPast([]);
    setPresent(cloneTree(node));
    setFuture([]);
  }, []);

  return { past, present, future, push, setDirect, undo, redo, reset };
};

const COLORS = {
  bg: "#F8FAFC",
  grid: "#E2E8F0",
  frameDark: "#5B2200",
  frameMid: "#7C2D12",
  frameLight: "#A16207",
  glass: "#22C1E6",
  glassStroke: "#0E7490",
  labelStroke: "#111827",
  labelFill: "#FFFFFF",
  mesh: "#CBD5E1",
  text: "#0F172A",
  selected: "#F97316",
  handleStroke: "#0F172A",
};

const PROFILE = { outer: 10, inner: 4, mullion: 12, sash: 6, gap: 2 };

function addProfileRect(layer: KonvaLayer | KonvaGroup, x: number, y: number, w: number, h: number, selected = false) {
  layer.add(new Konva.Rect({ x, y, width: w, height: h, stroke: selected ? COLORS.selected : COLORS.frameDark, strokeWidth: PROFILE.outer, listening: false }));
  layer.add(new Konva.Rect({ x: x + PROFILE.outer / 2 + 2, y: y + PROFILE.outer / 2 + 2, width: w - (PROFILE.outer + 4), height: h - (PROFILE.outer + 4), stroke: COLORS.frameMid, strokeWidth: PROFILE.inner, listening: false }));
  layer.add(new Konva.Rect({ x: x + PROFILE.outer / 2 + 6, y: y + PROFILE.outer / 2 + 6, width: w - (PROFILE.outer + 12), height: h - (PROFILE.outer + 12), stroke: COLORS.frameLight, strokeWidth: 1, opacity: 0.6, listening: false }));
}

function addMemberRect(layer: KonvaLayer | KonvaGroup, x: number, y: number, w: number, h: number) {
  layer.add(new Konva.Rect({ x, y, width: w, height: h, fill: "#FFFFFF", stroke: COLORS.frameDark, strokeWidth: 2, listening: false }));
  layer.add(new Konva.Rect({ x: x + 2, y: y + 2, width: w - 4, height: h - 4, stroke: COLORS.frameMid, strokeWidth: 1, opacity: 0.7, listening: false }));
}

function addTag(layer: KonvaLayer | KonvaGroup, x: number, y: number, text: string) {
  const padX = 6;
  const padY = 4;
  const t = new Konva.Text({ x, y, text, fontSize: 12, fontStyle: "bold", fill: COLORS.text, listening: false });
  const w = t.width() + padX * 2;
  const h = t.height() + padY * 2;
  layer.add(new Konva.Rect({ x: x - padX, y: y - padY, width: w, height: h, fill: COLORS.labelFill, stroke: COLORS.labelStroke, strokeWidth: 1, listening: false }));
  layer.add(t);
}

function addHandleIcon(layer: KonvaLayer | KonvaGroup, x: number, y: number, side: "left" | "right" | "top" | "bottom") {
  const g = new Konva.Group({ x, y, listening: false, opacity: 0.95 });
  g.add(new Konva.Rect({ x: 0, y: 0, width: 12, height: 22, cornerRadius: 3, fill: "#FFFFFF", stroke: COLORS.handleStroke, strokeWidth: 1.5 }));
  g.add(new Konva.Rect({ x: 4, y: 6, width: 14, height: 4, cornerRadius: 2, fill: COLORS.handleStroke, opacity: 0.85 }));
  g.add(new Konva.Circle({ x: 6, y: 16, radius: 2, fill: COLORS.handleStroke, opacity: 0.7 }));
  if (side === "right") g.rotation(0);
  else if (side === "left") { g.rotation(180); g.offsetX(6); g.offsetY(11); }
  else if (side === "top") { g.rotation(-90); g.offsetX(6); g.offsetY(11); }
  else if (side === "bottom") { g.rotation(90); g.offsetX(6); g.offsetY(11); }
  layer.add(g);
}

function addDimensionLine(layer: KonvaLayer | KonvaGroup, x1: number, y1: number, x2: number, y2: number, label: string) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  layer.add(new Konva.Arrow({ points: [x1, y1, x2, y2], stroke: "#6B7280", fill: "#6B7280", strokeWidth: 1.5, pointerLength: 6, pointerWidth: 6, listening: false }));
  layer.add(new Konva.Rect({ x: midX - 44, y: midY - 14, width: 88, height: 28, fill: "#FFFFFF", stroke: "#CBD5E1", strokeWidth: 1, cornerRadius: 2, listening: false }));
  layer.add(new Konva.Text({ x: midX - 44, y: midY - 10, width: 88, align: "center", text: label, fontSize: 16, fill: "#111827", listening: false }));
}

function drawMeshTriangle(group: KonvaGroup, x: number, y: number, size: number) {
  const meshSize = Math.max(38, size);
  const topX = x;
  const topY = y - meshSize;
  const leftX = x - meshSize;
  const leftY = y;
  group.add(new Konva.Line({ points: [leftX, leftY, x, y, topX, topY, leftX, leftY], stroke: COLORS.frameDark, strokeWidth: 1, listening: false }));
  const step = Math.max(6, Math.round(meshSize / 7));
  for (let i = step; i < meshSize; i += step) {
    group.add(new Konva.Line({ points: [x - i, y, x, y - i], stroke: "#334155", strokeWidth: 0.8, opacity: 0.8, listening: false }));
  }
  for (let i = step; i < meshSize; i += step) {
    group.add(new Konva.Line({ points: [x - i, y, x - i, y - (meshSize - i)], stroke: "#334155", strokeWidth: 0.8, opacity: 0.75, listening: false }));
  }
}

function resizeChildrenByDivider(parent: SectionNode, direction: "vertical" | "horizontal", dividerIndex: number, newBoundary: number, minFrac: number) {
  if (!parent.children || parent.children.length < 2) return;
  const kids = parent.children;
  const a = kids[dividerIndex];
  const b = kids[dividerIndex + 1];
  if (!a || !b) return;
  if (direction === "vertical") {
    const leftEdge = a.x;
    const rightEdge = b.x + b.w;
    const boundary = clamp(newBoundary, leftEdge + minFrac, rightEdge - minFrac);
    a.w = boundary - leftEdge;
    b.x = boundary;
    b.w = rightEdge - boundary;
    for (let i = 1; i < kids.length; i++) kids[i].x = kids[i - 1].x + kids[i - 1].w;
  } else {
    const topEdge = a.y;
    const bottomEdge = b.y + b.h;
    const boundary = clamp(newBoundary, topEdge + minFrac, bottomEdge - minFrac);
    a.h = boundary - topEdge;
    b.y = boundary;
    b.h = bottomEdge - boundary;
    for (let i = 1; i < kids.length; i++) kids[i].y = kids[i - 1].y + kids[i - 1].h;
  }
}

export function WindowDoorConfigurator({
  onSaveItem,
  onClose,
  initialItem,
  profitPercentage,
}: {
  onSaveItem: (item: QuotationItem) => void;
  onClose: () => void;
  initialItem?: QuotationItem | null;
  profitPercentage: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage | null>(null);
  const layerRef = useRef<KonvaLayer | null>(null);
  const gridGroupRef = useRef<KonvaGroup | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSlidingPanelIndex, setSelectedSlidingPanelIndex] = useState<number | null>(null);
  const [widthMm, setWidthMm] = useState(1500);
  const [heightMm, setHeightMm] = useState(1500);
  const [meta, setMeta] = useState<ProductMeta>(DEFAULT_META);
  const [baseSystemType, setBaseSystemType] = useState<SystemType>("Casement");
  const [splitCount, setSplitCount] = useState(2);
  const [splitDirection, setSplitDirection] = useState<SplitDirection>("vertical");
  const [baseGlass, setBaseGlass] = useState<YesNo>("Yes");
  const [baseMesh, setBaseMesh] = useState<YesNo>("No");
  const [isSaving, setIsSaving] = useState(false);
  const [hideSelectionForExport, setHideSelectionForExport] = useState(false);
  const [manualChildRates, setManualChildRates] = useState<Record<string, number>>({});
  const [autoChildRates, setAutoChildRates] = useState<Record<string, number>>({});
  const [childSectionMeta, setChildSectionMeta] = useState<Record<string, SectionOptionMeta>>({});
  const [isManualRate, setIsManualRate] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ w: 1200, h: 780 });

  const { past, future, present, push, setDirect, undo, redo, reset } = useHistory(buildPreset(DEFAULT_META.systemType as SystemType, "Yes", "No"));
  const root = present;
  const selectedNode = (selectedId ? findNode(root, selectedId) : null) ?? root;
  const selectedSystemSupportsCatalog = isCatalogSystem(selectedNode.systemType);
  const canInsertExhaustFan = selectedNode.systemType === "Casement" && selectedNode.description === "Fix" && !selectedNode.children?.length;
  const hasAdjustableExhaustFan = !selectedNode.children?.length && (selectedNode.systemType === "Exhaust Fan" || Boolean(selectedNode.hasExhaustFan));
  const isSlidingPanelSelection = selectedNode.systemType === "Sliding" && !selectedNode.children?.length && (selectedNode.panelFractions?.length ?? 0) > 1 && selectedSlidingPanelIndex !== null && selectedSlidingPanelIndex >= 0 && selectedSlidingPanelIndex < (selectedNode.panelFractions?.length ?? 0);
  const showSummaryPopup = selectedId !== null;
  const systemsQuery = useSystemsQuery();
  const selectedSeriesQuery = useSeriesQuery(selectedSystemSupportsCatalog ? selectedNode.systemType : "");
  const selectedDescriptionsQuery = useDescriptionsQuery(selectedSystemSupportsCatalog ? selectedNode.systemType : "", selectedSystemSupportsCatalog ? selectedNode.series : "");
  const optionsSystemType = selectedSystemSupportsCatalog ? selectedNode.systemType || baseSystemType : "";
  const metaOptionsQuery = useOptionsQuery(optionsSystemType);
  const systemOptions = Array.from(new Set([...(systemsQuery.data?.systems ?? ["Casement", "Sliding", "Slide N Fold"]), "Louvers", "Exhaust Fan"]));
  const selectableSystemOptions = systemOptions.filter((sys): sys is SystemType => sys === "Casement" || sys === "Sliding" || sys === "Slide N Fold" || sys === "Louvers" || sys === "Exhaust Fan");
  const seriesOptions = selectedSeriesQuery.data?.series ?? [];
  const descriptionOptions = selectedDescriptionsQuery.data?.descriptions ?? [];

  useEffect(() => {
    if (
      selectedNode.systemType !== "Sliding" ||
      !selectedNode.panelFractions?.length ||
      selectedNode.panelFractions.length < 2 ||
      selectedSlidingPanelIndex === null ||
      selectedSlidingPanelIndex >= selectedNode.panelFractions.length
    ) {
      setSelectedSlidingPanelIndex(null);
    }
  }, [selectedNode, selectedSlidingPanelIndex]);

  const rootDimensions = useMemo(() => ({ w: Math.max(widthMm, 0), h: Math.max(heightMm, 0) }), [widthMm, heightMm]);
  const view = useMemo(() => {
    const padding = 120;
    const maxW = stageSize.w - padding * 2;
    const maxH = stageSize.h - padding * 2;
    const ratio = Math.min(maxW / Math.max(rootDimensions.w, 1), maxH / Math.max(rootDimensions.h, 1));
    const drawW = rootDimensions.w * ratio;
    const drawH = rootDimensions.h * ratio;
    const offsetX = (stageSize.w - drawW) / 2 + panOffset.x;
    const offsetY = (stageSize.h - drawH) / 2 + panOffset.y;
    return { ratio, drawW, drawH, offsetX, offsetY };
  }, [panOffset, rootDimensions, stageSize]);

  const clampMm = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
  const updateSelectedNode = useCallback((mutate: (target: SectionNode) => void) => {
    if (!selectedId) return;
    const next = cloneTree(root);
    const target = findNode(next, selectedId);
    if (!target) return;
    mutate(target);
    push(next);
  }, [push, root, selectedId]);

  const updateSelectedLeaves = useCallback((mutate: (target: SectionNode) => void) => {
    if (!selectedId) return;
    const next = cloneTree(root);
    const target = findNode(next, selectedId);
    if (!target) return;
    if (target.children && target.children.length > 0) mapLeafNodes(target, mutate);
    else mutate(target);
    push(next);
  }, [push, root, selectedId]);

  const applyChildSizes = useCallback((parent: SectionNode, sizesMm: number[], direction: SplitDirection) => {
    if (!parent.children || parent.children.length !== sizesMm.length) return;
    let cursor = 0;
    parent.children.forEach((child, idx) => {
      if (direction === "vertical") {
        child.x = parent.x + cursor / widthMm;
        child.w = sizesMm[idx] / widthMm;
        child.y = parent.y;
        child.h = parent.h;
        cursor += sizesMm[idx];
      } else {
        child.y = parent.y + cursor / heightMm;
        child.h = sizesMm[idx] / heightMm;
        child.x = parent.x;
        child.w = parent.w;
        cursor += sizesMm[idx];
      }
    });
  }, [heightMm, widthMm]);

  const updateChildDimension = useCallback((parentId: string, index: number, newMmRaw: number, direction: SplitDirection) => {
    const next = cloneTree(root);
    const parent = findNode(next, parentId);
    if (!parent || !parent.children || parent.children.length < 2) return;
    const total = direction === "vertical" ? parent.w * widthMm : parent.h * heightMm;
    const current = parent.children.map((c) => Math.round(direction === "vertical" ? c.w * widthMm : c.h * heightMm));
    const newMm = clampMm(newMmRaw, 0, total);
    const remaining = total - newMm;
    const restSum = current.reduce((acc, val, i) => (i === index ? acc : acc + val), 0);
    const scaled = current.map((val, i) => {
      if (i === index) return newMm;
      if (restSum <= 0) return 0;
      return Math.max(0, Math.round((val / restSum) * remaining));
    });
    const sum = scaled.reduce((acc, val) => acc + val, 0);
    const diff = total - sum;
    if (diff !== 0) {
      const adjustIndex = scaled.findIndex((_, i) => i !== index);
      if (adjustIndex >= 0) scaled[adjustIndex] = Math.max(0, scaled[adjustIndex] + diff);
      else scaled[index] = Math.max(0, scaled[index] + diff);
    }
    applyChildSizes(parent, scaled, direction);
    push(next);
  }, [applyChildSizes, heightMm, push, root, widthMm]);

  const updateLeafPanelDimension = useCallback((leafId: string, index: number, newMmRaw: number) => {
    const next = cloneTree(root);
    const leaf = findNode(next, leafId);
    if (!leaf || !leaf.panelFractions || leaf.panelFractions.length < 2) return;
    const total = leaf.w * widthMm;
    const current = leaf.panelFractions.map((frac) => Math.round(frac * total));
    const newMm = clampMm(newMmRaw, 0, total);
    const remaining = total - newMm;
    const restSum = current.reduce((acc, val, i) => (i === index ? acc : acc + val), 0);
    const scaled = current.map((val, i) => {
      if (i === index) return newMm;
      if (restSum <= 0) return 0;
      return Math.max(0, Math.round((val / restSum) * remaining));
    });
    const sum = scaled.reduce((acc, val) => acc + val, 0);
    const diff = total - sum;
    if (diff !== 0) {
      const adjustIndex = scaled.findIndex((_, i) => i !== index);
      if (adjustIndex >= 0) scaled[adjustIndex] = Math.max(0, scaled[adjustIndex] + diff);
      else scaled[index] = Math.max(0, scaled[index] + diff);
    }
    leaf.panelFractions = scaled.map((val) => (total > 0 ? val / total : 0));
    push(next);
  }, [push, root, widthMm]);

  const dimensionLabels = useMemo(() => {
    const labels: Array<{ id: string; x: number; y: number; value: number; selectId: string | null; panelIndex?: number; onChange: (next: number) => void }> = [];
    const fx = view.offsetX;
    const fy = view.offsetY;
    const fw = view.drawW;
    const fh = view.drawH;
    const boxW = 88;
    const boxH = 28;
    const clampX = (x: number) => Math.max(0, Math.min(x, stageSize.w - boxW));
    const clampY = (y: number) => Math.max(0, Math.min(y, stageSize.h - boxH));
    const hierarchyOffset = 34;
    const splitParents: Array<{ node: SectionNode; depth: number }> = [];
    const collectSplits = (node: SectionNode, depth = 0) => {
      if (node.children && node.children.length >= 2 && node.split !== "none") splitParents.push({ node, depth });
      node.children?.forEach((child) => collectSplits(child, depth + 1));
    };
    collectSplits(root);
    const maxSplitDepth = splitParents.reduce((max, item) => Math.max(max, item.depth), 0);
    const splitParentsWithLevel = splitParents.map(({ node, depth }) => ({ node, depth, levelFromFrame: maxSplitDepth - depth }));
    const leavesForPanelRows: SectionNode[] = [];
    mapLeafNodes(root, (leaf) => leavesForPanelRows.push(leaf));
    const hasLeafPanelLabels = leavesForPanelRows.some((leaf) => (leaf.panelFractions?.length ?? 0) >= 2);
    const maxVerticalLevel = splitParentsWithLevel.reduce((max, item) => item.node.split === "vertical" ? Math.max(max, item.levelFromFrame) : max, -1);
    const maxHorizontalLevel = splitParentsWithLevel.reduce((max, item) => item.node.split === "horizontal" ? Math.max(max, item.levelFromFrame) : max, -1);
    const splitBaseOffset = 18;
    const panelRowBand = hasLeafPanelLabels ? 40 : 0;
    const verticalGuideBase = splitBaseOffset + panelRowBand;
    const horizontalGuideBase = splitBaseOffset;
    const mainHeightGuideX = fx - horizontalGuideBase - (maxHorizontalLevel >= 0 ? (maxHorizontalLevel + 1) * hierarchyOffset : 26);
    const hMidY = (fy + fy + fh) / 2;
    labels.push({ id: "height", x: clampX(mainHeightGuideX - 44), y: clampY(hMidY - 14), value: heightMm, selectId: "root", onChange: (next) => setHeightMm(clampMm(next, 0, 100000)) });
    const wMidX = (fx + fx + fw) / 2;
    const mainWidthGuideY = fy + fh + verticalGuideBase + (maxVerticalLevel >= 0 ? (maxVerticalLevel + 1) * hierarchyOffset : 26);
    labels.push({ id: "width", x: clampX(wMidX - 44), y: clampY(mainWidthGuideY - 14), value: widthMm, selectId: "root", onChange: (next) => setWidthMm(clampMm(next, 0, 100000)) });

    splitParentsWithLevel.forEach(({ node: parent, levelFromFrame }) => {
      if (parent.split === "vertical") {
        const y2 = fy + fh + verticalGuideBase + levelFromFrame * hierarchyOffset;
        parent.children!.forEach((c, idx) => {
          const midX = (fx + c.x * fw + fx + (c.x + c.w) * fw) / 2;
          labels.push({ id: `sub-w-${parent.id}-${idx}`, x: clampX(midX - 44), y: clampY(y2 - 14), value: Math.round(c.w * widthMm), selectId: c.id, onChange: (next) => updateChildDimension(parent.id, idx, next, "vertical") });
        });
      }
      if (parent.split === "horizontal") {
        const x2 = fx - horizontalGuideBase - levelFromFrame * hierarchyOffset;
        parent.children!.forEach((c, idx) => {
          const midY = (fy + c.y * fh + fy + (c.y + c.h) * fh) / 2;
          labels.push({ id: `sub-h-${parent.id}-${idx}`, x: clampX(x2 - 44), y: clampY(midY - 14), value: Math.round(c.h * heightMm), selectId: c.id, onChange: (next) => updateChildDimension(parent.id, idx, next, "horizontal") });
        });
      }
    });

    leavesForPanelRows.forEach((leaf) => {
      if (!leaf.panelFractions || leaf.panelFractions.length < 2) return;
      const leafX = fx + leaf.x * fw;
      const leafY = fy + leaf.y * fh;
      const leafW = leaf.w * fw;
      const leafH = leaf.h * fh;
      const y2 = leafY + leafH + splitBaseOffset;
      let cursor = leafX;
      leaf.panelFractions.forEach((frac, idx) => {
        const pw = leafW * frac;
        const midX = cursor + pw / 2;
        labels.push({ id: `leaf-${leaf.id}-${idx}`, x: clampX(midX - 44), y: clampY(y2 - 14), value: Math.round(frac * leaf.w * widthMm), selectId: leaf.id, panelIndex: idx, onChange: (next) => updateLeafPanelDimension(leaf.id, idx, next) });
        cursor += pw;
      });
    });
    return labels;
  }, [heightMm, root, stageSize, updateChildDimension, updateLeafPanelDimension, view, widthMm]);

  const areaSqft = useMemo(() => mmToSqft(widthMm, heightMm), [widthMm, heightMm]);
  const leafNodesForMode = useMemo(() => {
    const leaves: SectionNode[] = [];
    mapLeafNodes(root, (leaf) => leaves.push(leaf));
    return leaves.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }, [root]);
  const isCombinationDraft = leafNodesForMode.length > 1;
  const selectedIsWholeFrame = selectedId === null || selectedNode.id === "root";
  const isCombinationParentSelection = isCombinationDraft && selectedIsWholeFrame;
  const isCombinationChildSelection = isCombinationDraft && !selectedIsWholeFrame;
  const selectedLeafIndex = leafNodesForMode.findIndex((leaf) => leaf.id === selectedNode.id);
  const selectedSectionMeta: SectionOptionMeta = isCombinationChildSelection && selectedId ? (childSectionMeta[selectedId] ?? DEFAULT_SECTION_OPTION_META) : { colorFinish: meta.colorFinish, glassSpec: meta.glassSpec, handleType: meta.handleType, handleColor: meta.handleColor, meshType: meta.meshType };
  const metaHandleOption = metaOptionsQuery.data?.handleOptions.find((option) => option.name === selectedSectionMeta.handleType) ?? null;
  const updateSelectedSectionMeta = useCallback((patch: Partial<SectionOptionMeta>) => {
    if (!isCombinationChildSelection || !selectedId) {
      setMeta((prev) => ({ ...prev, ...patch }));
      return;
    }
    setChildSectionMeta((prev) => ({ ...prev, [selectedId]: { ...(prev[selectedId] ?? DEFAULT_SECTION_OPTION_META), ...patch } }));
  }, [isCombinationChildSelection, selectedId]);
  const getLeafSectionMeta = useCallback((leafId: string): SectionOptionMeta => childSectionMeta[leafId] ?? DEFAULT_SECTION_OPTION_META, [childSectionMeta]);
  const childAutoRef = isCombinationChildSelection && meta.refCode && selectedLeafIndex >= 0 ? `${meta.refCode}-${indexToAlphaLower(selectedLeafIndex)}` : "";
  const selectedLeafAreaSqft = isCombinationChildSelection && selectedLeafIndex >= 0 ? mmToSqft(leafNodesForMode[selectedLeafIndex].w * widthMm, leafNodesForMode[selectedLeafIndex].h * heightMm) : 0;
  const selectedChildRate = isCombinationChildSelection && selectedId ? (manualChildRates[selectedId] ?? autoChildRates[selectedId] ?? 0) : 0;
  const parentCombinationRate = useMemo(() => {
    const weightedRateTotal = leafNodesForMode.reduce((sum, leaf) => {
      const leafArea = mmToSqft(leaf.w * widthMm, leaf.h * heightMm);
      const leafRate = manualChildRates[leaf.id] ?? autoChildRates[leaf.id] ?? 0;
      return sum + leafRate * leafArea;
    }, 0);
    return areaSqft > 0 ? roundToTwo(weightedRateTotal / areaSqft) : 0;
  }, [areaSqft, autoChildRates, leafNodesForMode, manualChildRates, widthMm, heightMm]);

  useEffect(() => {
    if (!isCombinationDraft) {
      setAutoChildRates({});
      return;
    }
    let isActive = true;
    const run = async () => {
      const next: Record<string, number> = {};
      await Promise.all(leafNodesForMode.map(async (leaf) => {
        const leafMeta = getLeafSectionMeta(leaf.id);
        const systemType = leaf.systemType;
        const series = leaf.series || "";
        const description = leaf.description || getDefaultLeafDescription(systemType, meta.productType, leaf.hasExhaustFan);
        if (!systemType || !description || (isCatalogSystem(systemType) && !series)) {
          next[leaf.id] = 0;
          return;
        }
        try {
          const [descriptionsResp, optionsResp] = await Promise.all([
            isCatalogSystem(systemType) ? fetchDescriptions(systemType, series) : Promise.resolve({ descriptions: [] }),
            fetchOptions(systemType),
          ]);
          const area = mmToSqft(leaf.w * widthMm, leaf.h * heightMm);
          const calc = calculateRateForItem({ area, description, colorFinish: leafMeta.colorFinish, glassSpec: leaf.glass === "Yes" ? (leafMeta.glassSpec || "Yes") : "", handleType: leafMeta.handleType, handleColor: leafMeta.handleColor, meshPresent: leaf.mesh, meshType: leaf.mesh === "Yes" ? leafMeta.meshType : "" }, descriptionsResp.descriptions, optionsResp);
          next[leaf.id] = calc.rate;
        } catch {
          next[leaf.id] = 0;
        }
      }));
      if (!isActive) return;
      setAutoChildRates(next);
    };
    void run();
    return () => { isActive = false; };
  }, [getLeafSectionMeta, heightMm, isCombinationDraft, leafNodesForMode, meta.productType, widthMm]);

  const handleSaveItem = async () => {
    if (isSaving) return;
    if (!areAllDescriptionsFilled(root)) { alert("Please fill description for all windows"); return; }
    const trimmedRefCode = meta.refCode.trim();
    if (!trimmedRefCode) { alert("Ref Code is required."); return; }
    setIsSaving(true);
    try {
      setHideSelectionForExport(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      gridGroupRef.current?.visible(false);
      layerRef.current?.draw();
      const cropPadding = 10;
      const dataUrl = stageRef.current?.toDataURL({
        x: view.offsetX - cropPadding,
        y: view.offsetY - cropPadding,
        width: view.drawW + cropPadding * 2,
        height: view.drawH + cropPadding * 2,
        pixelRatio: 2
      }) ?? "";
      gridGroupRef.current?.visible(true);
      layerRef.current?.draw();
      setHideSelectionForExport(false);
      const leafNodes: SectionNode[] = [];
      mapLeafNodes(root, (leaf) => leafNodes.push(leaf));
      const alpha = (idx: number) => String.fromCharCode(97 + idx);
      const optionsCache = new Map<string, OptionsResponse>();
      const descriptionsCache = new Map<string, Description[]>();
      const getOptions = async (systemType: string) => {
        if (!systemType) return undefined;
        if (!optionsCache.has(systemType)) {
          try { optionsCache.set(systemType, await fetchOptions(systemType)); }
          catch { optionsCache.set(systemType, { colorFinishes: [], meshTypes: [], glassSpecs: [], handleOptions: [] }); }
        }
        return optionsCache.get(systemType);
      };
      const getDescriptions = async (systemType: string, series: string) => {
        const key = `${systemType}::${series}`;
        if (!systemType || !series) return [];
        if (!descriptionsCache.has(key)) {
          try { descriptionsCache.set(key, (await fetchDescriptions(systemType, series)).descriptions ?? []); }
          catch { descriptionsCache.set(key, []); }
        }
        return descriptionsCache.get(key) ?? [];
      };
      const buildSubItem = async (leaf: SectionNode, idx: number): Promise<QuotationSubItem> => {
        const leafMeta = getLeafSectionMeta(leaf.id);
        const systemType = leaf.systemType;
        const series = leaf.series || "";
        const description = leaf.description || getDefaultLeafDescription(systemType, meta.productType, leaf.hasExhaustFan);
        const itemArea = mmToSqft(leaf.w * widthMm, leaf.h * heightMm);
        const descriptions = await getDescriptions(systemType, series);
        const options = await getOptions(systemType);
        const calc = calculateRateForItem({ area: itemArea, description, colorFinish: leafMeta.colorFinish, glassSpec: leaf.glass === "Yes" ? (leafMeta.glassSpec || "Yes") : "", handleType: leafMeta.handleType, handleColor: leafMeta.handleColor, meshPresent: leaf.mesh, meshType: leaf.mesh === "Yes" ? leafMeta.meshType : "" }, descriptions, options);
        const computedRate = calc.rate;
        const resolvedRate = manualChildRates[leaf.id] ?? autoChildRates[leaf.id] ?? computedRate;
        const quantity = 1;
        return {
          id: crypto.randomUUID(),
          refCode: meta.refCode ? `${meta.refCode}-${alpha(idx)}` : "",
          location: meta.location || "",
          width: Math.round(leaf.w * widthMm),
          height: Math.round(leaf.h * heightMm),
          area: itemArea,
          systemType,
          series,
          description,
          colorFinish: leafMeta.colorFinish,
          glassSpec: leaf.glass === "Yes" ? (leafMeta.glassSpec || "Yes") : "",
          handleType: leafMeta.handleType,
          handleColor: leafMeta.handleColor,
          handleCount: calc.handleCount,
          meshPresent: leaf.mesh,
          meshType: leaf.mesh === "Yes" ? leafMeta.meshType : "",
          rate: roundToTwo(resolvedRate),
          quantity,
          amount: roundToTwo(quantity * roundToTwo(resolvedRate) * itemArea),
          sash: leaf.sash,
          panelSashes: leaf.panelSashes,
          refImage: "",
          remarks: meta.remarks || "",
          hasExhaustFan: Boolean(leaf.hasExhaustFan),
          exhaustFanX: leaf.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X,
          exhaustFanY: leaf.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y,
          exhaustFanSize: leaf.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE,
          baseRate: calc.baseRate,
          areaSlabIndex: calc.areaSlabIndex,
        };
      };
      const subItems = await Promise.all(leafNodes.map((leaf, idx) => buildSubItem(leaf, idx)));
      const isCombination = subItems.length > 1;
      const anyMesh = subItems.some((item) => item.meshPresent === "Yes");
      const singleLeaf = leafNodes[0];
      let rate = 0;
      let amount = 0;
      let baseRate = 0;
      let areaSlabIndex = 0;
      let handleCount = 0;
      if (!isCombination && singleLeaf) {
        const systemType = singleLeaf.systemType;
        const series = singleLeaf.series || "";
        const description = singleLeaf.description || getDefaultLeafDescription(systemType, meta.productType, singleLeaf.hasExhaustFan);
        const descriptions = await getDescriptions(systemType, series);
        const options = await getOptions(systemType);
        const calc = calculateRateForItem({ area: areaSqft, description, colorFinish: meta.colorFinish, glassSpec: singleLeaf.glass === "Yes" ? (meta.glassSpec || "Yes") : "", handleType: meta.handleType, handleColor: meta.handleColor, meshPresent: singleLeaf.mesh, meshType: singleLeaf.mesh === "Yes" ? meta.meshType : "" }, descriptions, options);
        baseRate = calc.baseRate;
        areaSlabIndex = calc.areaSlabIndex;
        handleCount = calc.handleCount;
        rate = isManualRate ? meta.rate : calc.rate;
        amount = roundToTwo(Math.max(1, meta.quantity || 1) * rate * areaSqft);
      } else {
        const parentQuantity = Math.max(1, meta.quantity || 1);
        const perFrameAmount = roundToTwo(subItems.reduce((sum, sub) => sum + sub.amount, 0));
        const weightedRateTotal = subItems.reduce((sum, sub) => sum + sub.rate * sub.area, 0);
        rate = areaSqft > 0 ? roundToTwo(weightedRateTotal / areaSqft) : 0;
        amount = roundToTwo(perFrameAmount * parentQuantity);
      }
      const nextItem: QuotationItem = {
        id: initialItem?.id ?? crypto.randomUUID(),
        refCode: trimmedRefCode,
        location: meta.location || "",
        projectLocation: meta.location || "",
        width: widthMm,
        height: heightMm,
        area: areaSqft,
        productType: meta.productType,
        material: initialItem?.material ?? "",
        designType: initialItem?.designType ?? "",
        openingType: initialItem?.openingType ?? "",
        glassType: initialItem?.glassType ?? "",
        accessories: initialItem?.accessories ?? [],
        specialNotes: meta.remarks || "",
        systemType: isCombination ? COMBINATION_SYSTEM : singleLeaf?.systemType || baseSystemType,
        series: isCombination ? "" : singleLeaf?.series || "",
        description: isCombination ? "" : singleLeaf?.description || getDefaultLeafDescription(singleLeaf?.systemType || baseSystemType, meta.productType, singleLeaf?.hasExhaustFan),
        colorFinish: isCombination ? "" : meta.colorFinish,
        glassSpec: isCombination ? "" : singleLeaf?.glass === "Yes" ? (meta.glassSpec || "Yes") : "",
        handleType: isCombination ? "" : meta.handleType,
        handleColor: isCombination ? "" : meta.handleColor,
        handleCount,
        meshPresent: isCombination ? "" : singleLeaf?.mesh || "No",
        meshType: isCombination ? "" : anyMesh ? meta.meshType : "",
        rate,
        quantity: Math.max(1, meta.quantity || 1),
        amount,
        sash: isCombination ? undefined : singleLeaf?.sash,
        panelSashes: isCombination ? undefined : singleLeaf?.panelSashes,
        refImage: dataUrl,
        remarks: meta.remarks || "",
        hasExhaustFan: isCombination ? false : Boolean(singleLeaf?.hasExhaustFan),
        exhaustFanX: isCombination ? undefined : singleLeaf?.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X,
        exhaustFanY: isCombination ? undefined : singleLeaf?.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y,
        exhaustFanSize: isCombination ? undefined : singleLeaf?.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE,
        baseRate,
        areaSlabIndex,
        subItems: isCombination ? subItems : [],
        laborRate: initialItem?.laborRate ?? 0,
        transportRate: initialItem?.transportRate ?? 0,
        discountPercent: initialItem?.discountPercent ?? 0,
        previewPanels: initialItem?.previewPanels ?? 1,
      };
      onSaveItem(nextItem);
      onClose();
    } finally {
      setHideSelectionForExport(false);
      setIsSaving(false);
    }
  };

  const splitSelected = useCallback((direction: SplitDirection) => {
    if (!selectedId || !selectedNode || selectedNode.children?.length || selectedNode.systemType === "Sliding") return;
    const next = cloneTree(root);
    const target = findNode(next, selectedId);
    if (!target) return;
    target.split = direction;
    target.children = buildSplitChildren(target, direction, baseSystemType, baseGlass, baseMesh, splitCount);
    if (baseSystemType === "Sliding" && target.children) {
      target.children.forEach((c, idx) => {
        c.systemType = "Sliding";
        c.sash = idx % 2 === 0 ? "left" : "right";
      });
    }
    push(next);
  }, [root, selectedId, selectedNode, baseSystemType, baseGlass, baseMesh, push, splitCount]);

  const mergeSelected = useCallback(() => {
    if (!selectedId) return;
    const next = cloneTree(root);
    const target = findNode(next, selectedId);
    if (!target) return;
    const mergeNode = target.children?.length ? target : findParent(next, selectedId);
    if (!mergeNode) return;
    mergeNode.split = "none";
    mergeNode.children = undefined;
    push(next);
  }, [push, root, selectedId]);

  const renderCanvas = useCallback(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;
    layer.destroyChildren();
    layer.add(new Konva.Rect({ x: 0, y: 0, width: stageSize.w, height: stageSize.h, fill: COLORS.bg }));
    const panHit = new Konva.Rect({ x: 0, y: 0, width: stageSize.w, height: stageSize.h, fill: "rgba(255,255,255,0.001)", listening: true });
    panHit.on("mousedown touchstart", (event) => {
      event.cancelBubble = true;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      isPanningRef.current = true;
      panStartRef.current = pointer;
      panOriginRef.current = panOffset;
      setSelectedId(null);
      setSelectedSlidingPanelIndex(null);
      stage.container().style.cursor = "grabbing";
    });
    panHit.on("mouseenter", () => { if (!isPanningRef.current) stage.container().style.cursor = "grab"; });
    panHit.on("mouseleave", () => { if (!isPanningRef.current) stage.container().style.cursor = "default"; });
    layer.add(panHit);
    const gridGroup = new Konva.Group();
    gridGroupRef.current = gridGroup;
    layer.add(gridGroup);
    const gridSize = 20;
    for (let x = 0; x <= stageSize.w; x += gridSize) gridGroup.add(new Konva.Line({ points: [x, 0, x, stageSize.h], stroke: COLORS.grid, strokeWidth: x % (gridSize * 5) === 0 ? 1.2 : 0.6, listening: false }));
    for (let y = 0; y <= stageSize.h; y += gridSize) gridGroup.add(new Konva.Line({ points: [0, y, stageSize.w, y], stroke: COLORS.grid, strokeWidth: y % (gridSize * 5) === 0 ? 1.2 : 0.6, listening: false }));
    const fx = view.offsetX;
    const fy = view.offsetY;
    const fw = view.drawW;
    const fh = view.drawH;
    const selectedForRender = hideSelectionForExport ? null : selectedId;
    addProfileRect(layer, fx, fy, fw, fh, selectedForRender === "root");
    const rootHit = new Konva.Rect({ x: fx, y: fy, width: fw, height: fh, fill: "transparent" });
    rootHit.on("mousedown touchstart", () => { setSelectedId(null); setSelectedSlidingPanelIndex(null); });
    layer.add(rootHit);
    const drawParentDividers = (parent: SectionNode) => {
      if (!parent.children || parent.children.length < 2) return;
      const dir = parent.split;
      if (dir !== "vertical" && dir !== "horizontal") return;
      const minPx = 70;
      const minFrac = (minPx / (dir === "vertical" ? fw : fh)) * parent[dir === "vertical" ? "w" : "h"];
      for (let i = 0; i < parent.children.length - 1; i++) {
        const a = parent.children[i];
        const boundary = dir === "vertical" ? a.x + a.w : a.y + a.h;
        if (dir === "vertical") {
          const x = fx + boundary * fw;
          addMemberRect(layer, x - PROFILE.mullion / 2, fy + PROFILE.outer, PROFILE.mullion, fh - PROFILE.outer * 2);
        } else {
          const y = fy + boundary * fh;
          addMemberRect(layer, fx + PROFILE.outer, y - PROFILE.mullion / 2, fw - PROFILE.outer * 2, PROFILE.mullion);
        }
        resizeChildrenByDivider(parent, dir, i, boundary, minFrac);
      }
      parent.children.forEach(drawParentDividers);
    };
    drawParentDividers(root);
    const leaves: SectionNode[] = [];
    mapLeafNodes(root, (leaf) => leaves.push(leaf));
    leaves.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    leaves.forEach((leaf, idx) => {
      const x = fx + leaf.x * fw;
      const y = fy + leaf.y * fh;
      const w = leaf.w * fw;
      const h = leaf.h * fh;
      const isSelected = leaf.id === selectedForRender;
      const g = new Konva.Group({ listening: true, draggable: false });
      const leafHit = new Konva.Rect({ x, y, width: w, height: h, fill: "rgba(255,255,255,0.01)", listening: true });
      leafHit.on("mousedown touchstart", (event) => {
        event.cancelBubble = true;
        setSelectedId(leaf.id);
        setSelectedSlidingPanelIndex(null);
      });
      g.add(leafHit);
      g.add(new Konva.Rect({ x: x + PROFILE.outer / 2 + PROFILE.gap, y: y + PROFILE.outer / 2 + PROFILE.gap, width: w - (PROFILE.outer + PROFILE.gap * 2), height: h - (PROFILE.outer + PROFILE.gap * 2), stroke: isSelected ? COLORS.selected : COLORS.frameDark, strokeWidth: PROFILE.sash, listening: false }));
      const inset = PROFILE.outer / 2 + PROFILE.sash + 6;
      const handledByDescription = (() => {
        const desc = leaf.description;
        if (!desc) return false;
        const innerX = x + inset;
        const innerY = y + inset;
        const innerW = w - inset * 2;
        const innerH = h - inset * 2;
        const fixedPanel = (px: number, py: number, pw: number, ph: number) => g.add(new Konva.Rect({ x: px, y: py, width: pw, height: ph, fill: leaf.glass === "Yes" ? COLORS.glass : "#FFFFFF", stroke: COLORS.glassStroke, strokeWidth: 1, opacity: leaf.glass === "Yes" ? 1 : 0.6, listening: false }));
        const drawPanels = (fractions: number[], sashTypes?: SashType[], meshCount = 0) => {
          const isPanelizedSliding = leaf.systemType === "Sliding" && fractions.length > 1;
          const panelSashes = isPanelizedSliding ? (leaf.panelSashes && leaf.panelSashes.length === fractions.length ? leaf.panelSashes : buildDefaultSlidingPanelSashes(fractions.length)) : [];
          let cursor = innerX;
          fractions.forEach((frac, idx) => {
            const pw = innerW * frac;
            fixedPanel(cursor, innerY, pw, innerH);
            if (sashTypes?.[idx]) drawSashGlyph(g, cursor, innerY, pw, innerH, sashTypes[idx], COLORS.frameDark);
            if (isPanelizedSliding) {
              const panelSash = panelSashes[idx] ?? "fixed";
              const arrowY = innerY + innerH / 2;
              if (panelSash === "double") {
                g.add(new Konva.Arrow({ points: [cursor + pw * 0.5, arrowY, cursor + pw * 0.25, arrowY], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 7, pointerWidth: 7, opacity: 0.7, listening: false }));
                g.add(new Konva.Arrow({ points: [cursor + pw * 0.5, arrowY, cursor + pw * 0.75, arrowY], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 7, pointerWidth: 7, opacity: 0.7, listening: false }));
              } else if (panelSash === "left" || panelSash === "right") {
                const from = panelSash === "left" ? cursor + pw * 0.75 : cursor + pw * 0.25;
                const to = panelSash === "left" ? cursor + pw * 0.25 : cursor + pw * 0.75;
                g.add(new Konva.Arrow({ points: [from, arrowY, to, arrowY], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 7, pointerWidth: 7, opacity: 0.7, listening: false }));
              }
              const panelHit = new Konva.Rect({ x: cursor, y: innerY, width: pw, height: innerH, fill: "rgba(255,255,255,0.001)", stroke: isSelected && selectedSlidingPanelIndex === idx ? COLORS.selected : "rgb(30, 30, 30)", strokeWidth: 7, listening: true });
              panelHit.on("mousedown touchstart", (event) => { event.cancelBubble = true; setSelectedId(leaf.id); setSelectedSlidingPanelIndex(idx); });
              g.add(panelHit);
            }
            if (meshCount > 0 && idx >= fractions.length - meshCount) drawMeshTriangle(g, cursor + pw - 6, innerY + innerH - 6, Math.min(pw, innerH) * 0.5);
            cursor += pw;
          });
        };
        const isOneOf = (...variants: string[]) => variants.includes(desc);
        if (leaf.systemType === "Louvers" || desc === "Louvers") { fixedPanel(innerX, innerY, innerW, innerH); drawLouversGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Exhaust Fan" || leaf.hasExhaustFan || desc === "Exhaust Fan" || desc === "Fix + Exhaust Fan") { fixedPanel(innerX, innerY, innerW, innerH); drawExhaustFanGuide(g, innerX, innerY, innerW, innerH, leaf.exhaustFanX, leaf.exhaustFanY, leaf.exhaustFanSize); return true; }
        if (desc === "Fix") { fixedPanel(innerX, innerY, innerW, innerH); return true; }
        if (isOneOf("Left Openable", "Left Openable Door-Window", "Left Openable Window", "Left Openable Door")) { fixedPanel(innerX, innerY, innerW, innerH); drawCasementSwingGuide(g, innerX, innerY, innerW, innerH, "left"); return true; }
        if (isOneOf("Right Openable", "Right Openable Door-Window", "Right Openable Window", "Right Openable Door")) { fixedPanel(innerX, innerY, innerW, innerH); drawCasementSwingGuide(g, innerX, innerY, innerW, innerH, "right"); return true; }
        if (desc === "Top Hung Window") { fixedPanel(innerX, innerY, innerW, innerH); drawTopHungGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (desc === "Bottom Hung Window") { fixedPanel(innerX, innerY, innerW, innerH); drawBottomHungGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (desc === "Parallel Window") { fixedPanel(innerX, innerY, innerW, innerH); drawSashGlyph(g, innerX, innerY, innerW, innerH, "double", COLORS.frameDark); return true; }
        if (desc === "Tilt and Turn Window") { fixedPanel(innerX, innerY, innerW, innerH); drawTiltTurnGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (isOneOf("French Door-Window", "French Door", "French Window")) {
          const centerGap = Math.max(10, Math.min(22, innerW * 0.05));
          const panelW = (innerW - centerGap) / 2;
          fixedPanel(innerX, innerY, panelW, innerH);
          fixedPanel(innerX + panelW + centerGap, innerY, panelW, innerH);
          drawFrenchGuide(g, innerX, innerY, innerW, innerH);
          return true;
        }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldTwoPanelOnePlusOne(desc)) { fixedPanel(innerX, innerY, innerW, innerH); drawSlideNFoldTwoPanelGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldThreePanelOnePlusTwo(desc)) { fixedPanel(innerX, innerY, innerW, innerH); drawSlideNFoldThreePanelOnePlusTwoGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldFourPanelOnePlusThree(desc)) { fixedPanel(innerX, innerY, innerW, innerH); drawSlideNFoldFourPanelOnePlusThreeGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldFivePanelOnePlusFour(desc)) { fixedPanel(innerX, innerY, innerW, innerH); drawSlideNFoldFivePanelOnePlusFourGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldSixPanelOnePlusFive(desc)) { fixedPanel(innerX, innerY, innerW, innerH); drawSlideNFoldSixPanelOnePlusFiveGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (desc === "Left Openable + Fixed") { drawPanels([0.5, 0.5], ["left", "fixed"]); return true; }
        if (desc === "Right Openable + Fixed") { drawPanels([0.5, 0.5], ["fixed", "right"]); return true; }
        if (desc === "Left Openable + Fixed + Right Openable") { drawPanels([0.33, 0.34, 0.33], ["left", "fixed", "right"]); return true; }
        const pattern = parsePanelPattern(desc);
        if (pattern) {
          const fractions = leaf.panelFractions && leaf.panelFractions.length === pattern.fractions.length ? leaf.panelFractions : pattern.fractions;
          drawPanels(fractions, undefined, leaf.panelMeshCount ?? pattern.meshCount ?? 0);
          return true;
        }
        return false;
      })();
      if (!handledByDescription) g.add(new Konva.Rect({ x: x + inset, y: y + inset, width: w - inset * 2, height: h - inset * 2, fill: leaf.glass === "Yes" ? COLORS.glass : "#FFFFFF", stroke: COLORS.glassStroke, strokeWidth: 0.6, opacity: leaf.glass === "Yes" ? 1 : 0.6, listening: false }));
      const parsedPattern = parsePanelPattern(leaf.description || "");
      const hasPatternMesh = (leaf.panelMeshCount ?? parsedPattern?.meshCount ?? 0) > 0;
      if (leaf.mesh === "Yes" && !hasPatternMesh) drawMeshTriangle(g, x + w - inset - 6, y + h - inset - 6, Math.min(w, h) * 0.5);
      const insetHandle = inset + 6;
      const isSliding = leaf.systemType === "Sliding";
      const hasSlidingPanels = isSliding && (leaf.panelFractions?.length ?? 0) > 1;
      const isSlideFold = leaf.systemType === "Slide N Fold";
      const isLouver = leaf.systemType === "Louvers";
      const isExhaust = leaf.systemType === "Exhaust Fan" || Boolean(leaf.hasExhaustFan);
      const isCustomSlideNFoldPattern = isSlideFold && (isSlideNFoldTwoPanelOnePlusOne(leaf.description || "") || isSlideNFoldThreePanelOnePlusTwo(leaf.description || "") || isSlideNFoldFourPanelOnePlusThree(leaf.description || "") || isSlideNFoldFivePanelOnePlusFour(leaf.description || "") || isSlideNFoldSixPanelOnePlusFive(leaf.description || ""));
      const isOpenable = !isSliding && !isSlideFold && !isLouver && !isExhaust && leaf.sash !== "fixed";
      const isSlidingMove = isSliding && (leaf.sash === "left" || leaf.sash === "right" || leaf.sash === "double");
      if (isOpenable) {
        if (leaf.sash === "left") addHandleIcon(g, x + w - insetHandle - 18, y + h / 2 - 18, "right");
        else if (leaf.sash === "right") addHandleIcon(g, x + insetHandle, y + h / 2 - 18, "left");
        else if (leaf.sash === "top") addHandleIcon(g, x + w / 2 - 6, y + h - insetHandle - 26, "bottom");
        else if (leaf.sash === "bottom") addHandleIcon(g, x + w / 2 - 6, y + insetHandle, "top");
        else if (leaf.sash === "double") addHandleIcon(g, x + w / 2 - 6, y + h / 2 - 18, "right");
      }
      if (isSlidingMove && !hasSlidingPanels) {
        if (leaf.sash === "left") addHandleIcon(g, x + w * 0.55, y + h / 2 - 18, "right");
        if (leaf.sash === "right") addHandleIcon(g, x + w * 0.4, y + h / 2 - 18, "left");
        if (leaf.sash === "double") {
          addHandleIcon(g, x + w * 0.47, y + h / 2 - 18, "right");
          addHandleIcon(g, x + w * 0.53, y + h / 2 - 18, "left");
        }
        const arrowY = y + h / 2;
        if (leaf.sash === "double") {
          g.add(new Konva.Arrow({ points: [x + w * 0.5, arrowY, x + w * 0.28, arrowY], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 8, pointerWidth: 8, opacity: 0.7, listening: false }));
          g.add(new Konva.Arrow({ points: [x + w * 0.5, arrowY, x + w * 0.72, arrowY], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 8, pointerWidth: 8, opacity: 0.7, listening: false }));
        } else {
          const from = leaf.sash === "left" ? x + w * 0.72 : x + w * 0.28;
          const to = leaf.sash === "left" ? x + w * 0.28 : x + w * 0.72;
          g.add(new Konva.Arrow({ points: [from, arrowY, to, arrowY], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 8, pointerWidth: 8, opacity: 0.7, listening: false }));
        }
      }
      if (isSliding) g.add(new Konva.Line({ points: [x + inset, y + h - (PROFILE.outer / 2 + 6), x + w - inset, y + h - (PROFILE.outer / 2 + 6)], stroke: "#475569", strokeWidth: 0.6, opacity: 0.8, listening: false }));
      if (isSlideFold && !isCustomSlideNFoldPattern) {
        const foldX = x + w * 0.72;
        g.add(new Konva.Line({ points: [foldX, y + inset, foldX, y + h - inset], stroke: "#334155", strokeWidth: 0.6, dash: [4, 3], opacity: 0.8, listening: false }));
        g.add(new Konva.Arrow({ points: [foldX - 18, y + h * 0.2, foldX + 18, y + h * 0.2], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 6, pointerWidth: 6, opacity: 0.65, listening: false }));
      }
      if (isExhaust) {
        const fanGeometry = getExhaustFanGeometry(x + inset, y + inset, w - inset * 2, h - inset * 2, leaf.exhaustFanX, leaf.exhaustFanY, leaf.exhaustFanSize);
        const fanDiameterMm = Math.round(Math.min(leaf.w * widthMm, leaf.h * heightMm) * clampValue(leaf.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE, 0.2, 0.9) * 1.18);
        const dimOffset = 22;
        if (!hideSelectionForExport) {
          addDimensionLine(g, fanGeometry.centerX - fanGeometry.outerRadius, fanGeometry.centerY - fanGeometry.outerRadius - dimOffset, fanGeometry.centerX + fanGeometry.outerRadius, fanGeometry.centerY - fanGeometry.outerRadius - dimOffset, `${fanDiameterMm} mm`);
          addDimensionLine(g, fanGeometry.centerX + fanGeometry.outerRadius + dimOffset, fanGeometry.centerY - fanGeometry.outerRadius, fanGeometry.centerX + fanGeometry.outerRadius + dimOffset, fanGeometry.centerY + fanGeometry.outerRadius, `${fanDiameterMm} mm`);
        }
      }
      g.add(new Konva.Text({ text: getSectionLabel(leaf, meta.productType), x: x + 8, y: y + 8, fontSize: 12, fill: COLORS.text, listening: false }));
      g.add(new Konva.Circle({ x: x + w / 2, y: y + h / 2 - 10, radius: 14, fill: "#FFFFFF", stroke: COLORS.frameDark, strokeWidth: 0.6, listening: false }));
      g.add(new Konva.Text({ x: x + w / 2 - 14, y: y + h / 2 - 18, width: 28, align: "center", text: String(idx + 1), fontSize: 12, fontStyle: "bold", fill: COLORS.text, listening: false }));
      g.add(new Konva.Line({ points: [x + w / 2 - 10, y + h / 2 + 8, x + w / 2 + 10, y + h / 2 + 8], stroke: COLORS.frameDark, strokeWidth: 0.6, opacity: 0.85, listening: false }));
      g.add(new Konva.Line({ points: [x + w / 2, y + h / 2 - 2, x + w / 2, y + h / 2 + 18], stroke: COLORS.frameDark, strokeWidth: 0.6, opacity: 0.85, listening: false }));
      layer.add(g);
    });
    const splitDepths: Array<{ split: SplitDirection; depth: number }> = [];
    const collectSplitDepths = (node: SectionNode, depth = 0) => {
      if (node.children && node.children.length >= 2 && node.split !== "none") splitDepths.push({ split: node.split, depth });
      node.children?.forEach((child) => collectSplitDepths(child, depth + 1));
    };
    collectSplitDepths(root);
    const maxSplitDepth = splitDepths.reduce((max, item) => Math.max(max, item.depth), 0);
    const maxVerticalLevel = splitDepths.reduce((max, item) => item.split !== "vertical" ? max : Math.max(max, maxSplitDepth - item.depth), -1);
    const maxHorizontalLevel = splitDepths.reduce((max, item) => item.split !== "horizontal" ? max : Math.max(max, maxSplitDepth - item.depth), -1);
    const hierarchyOffset = 34;
    const hasLeafPanelLabels = leaves.some((leaf) => (leaf.panelFractions?.length ?? 0) >= 2);
    const splitBaseOffset = 18;
    const panelRowBand = hasLeafPanelLabels ? 40 : 0;
    const verticalGuideBase = splitBaseOffset + panelRowBand;
    const horizontalGuideBase = splitBaseOffset;
    const mainHeightGuideX = fx - horizontalGuideBase - (maxHorizontalLevel >= 0 ? (maxHorizontalLevel + 1) * hierarchyOffset : 26);
    const mainWidthGuideY = fy + fh + verticalGuideBase + (maxVerticalLevel >= 0 ? (maxVerticalLevel + 1) * hierarchyOffset : 26);
    if (!hideSelectionForExport) {
      addDimensionLine(layer, mainHeightGuideX, fy, mainHeightGuideX, fy + fh, `${heightMm} `);
      addDimensionLine(layer, fx, mainWidthGuideY, fx + fw, mainWidthGuideY, `${widthMm} `);
      if (root.split === "vertical" && (root.children?.length ?? 0) >= 2) {
        const y2 = fy + fh + verticalGuideBase;
        root.children!.forEach((c) => addDimensionLine(layer, fx + c.x * fw, y2, fx + (c.x + c.w) * fw, y2, `${Math.round(c.w * widthMm)}`));
      }
      if (root.split === "horizontal" && (root.children?.length ?? 0) >= 2) {
        const x2 = fx - horizontalGuideBase;
        root.children!.forEach((c) => addDimensionLine(layer, x2, fy + c.y * fh, x2, fy + (c.y + c.h) * fh, `${Math.round(heightMm * c.h)}`));
      }
    }
    const leaves2: SectionNode[] = [];
    mapLeafNodes(root, (leaf) => leaves2.push(leaf));
    const rightMost = [...leaves2].sort((a, b) => (b.x + b.w) - (a.x + a.w) || (b.y + b.h) - (a.y + a.h))[0];
    if (rightMost) addTag(layer, fx + rightMost.x * fw + rightMost.w * fw - 54, fy + rightMost.y * fh + rightMost.h * fh - 54, "F1");
    layer.draw();
  }, [heightMm, hideSelectionForExport, panOffset, root, selectedId, selectedSlidingPanelIndex, stageSize.h, stageSize.w, view, widthMm]);

  useEffect(() => {
    if (!containerRef.current) return;
    const stage = new Konva.Stage({ container: containerRef.current, width: stageSize.w, height: stageSize.h });
    const layer = new Konva.Layer();
    stage.add(layer);
    const handlePanMove = () => {
      if (!isPanningRef.current) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      setPanOffset({ x: panOriginRef.current.x + (pointer.x - panStartRef.current.x), y: panOriginRef.current.y + (pointer.y - panStartRef.current.y) });
    };
    const stopPanning = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      stage.container().style.cursor = "grab";
    };
    stage.on("mousemove touchmove", handlePanMove);
    stage.on("mouseup touchend touchcancel mouseleave", stopPanning);
    stageRef.current = stage;
    layerRef.current = layer;
    renderCanvas();
    return () => {
      stage.off("mousemove touchmove", handlePanMove);
      stage.off("mouseup touchend touchcancel mouseleave", stopPanning);
      stage.destroy();
      stageRef.current = null;
      layerRef.current = null;
    };
  }, [renderCanvas, stageSize.h, stageSize.w]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(420, Math.floor(rect.width));
      const fallbackH = typeof window !== "undefined" ? window.innerHeight - 120 : 860;
      const h = Math.max(720, Math.floor(rect.height > 0 ? rect.height : fallbackH));
      setStageSize({ w, h });
      if (stageRef.current) {
        stageRef.current.width(w);
        stageRef.current.height(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  useEffect(() => {
    if (!initialItem) return;
    const mapped = mapItemToConfiguratorState(initialItem);
    setWidthMm(mapped.width);
    setHeightMm(mapped.height);
    setBaseSystemType(mapped.baseSystemType);
    setBaseGlass(mapped.baseGlass);
    setBaseMesh(mapped.baseMesh);
    setMeta(mapped.meta);
    reset(mapped.root);
    const mappedLeaves: SectionNode[] = [];
    mapLeafNodes(mapped.root, (leaf) => mappedLeaves.push(leaf));
    setSelectedId(mappedLeaves.length > 1 ? mappedLeaves[0].id : "root");
    setSelectedSlidingPanelIndex(null);
    setIsManualRate(false);
    const leaves: SectionNode[] = [];
    mapLeafNodes(mapped.root, (leaf) => leaves.push(leaf));
    const sortedLeaves = leaves.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const subItems = initialItem.subItems ?? [];
    const nextManualRates: Record<string, number> = {};
    const nextChildSectionMeta: Record<string, SectionOptionMeta> = {};
    sortedLeaves.forEach((leaf, idx) => {
      if (subItems[idx]?.rate !== undefined) nextManualRates[leaf.id] = Number(subItems[idx].rate) || 0;
      if (subItems[idx]) {
        nextChildSectionMeta[leaf.id] = { colorFinish: subItems[idx].colorFinish || "", glassSpec: subItems[idx].glassSpec || "", handleType: subItems[idx].handleType || "", handleColor: subItems[idx].handleColor || "", meshType: subItems[idx].meshType || "" };
        leaf.exhaustFanX = typeof subItems[idx].exhaustFanX === "number" ? subItems[idx].exhaustFanX : leaf.exhaustFanX;
        leaf.exhaustFanY = typeof subItems[idx].exhaustFanY === "number" ? subItems[idx].exhaustFanY : leaf.exhaustFanY;
        leaf.exhaustFanSize = typeof subItems[idx].exhaustFanSize === "number" ? subItems[idx].exhaustFanSize : leaf.exhaustFanSize;
      }
    });
    setManualChildRates(nextManualRates);
    setAutoChildRates({});
    setChildSectionMeta(nextChildSectionMeta);
  }, [initialItem, reset]);

  useEffect(() => {
    if (initialItem) return;
    reset(buildPreset(baseSystemType, baseGlass, baseMesh));
    setSelectedId(null);
    setManualChildRates({});
    setAutoChildRates({});
    setChildSectionMeta({});
    setIsManualRate(false);
  }, [baseGlass, baseMesh, baseSystemType, initialItem, reset]);

  useEffect(() => {
    setIsManualRate(false);
  }, [selectedNode.systemType, selectedNode.series, selectedNode.description, selectedNode.glass, selectedNode.mesh, meta.colorFinish, meta.glassSpec, meta.handleType, meta.handleColor, meta.meshType, widthMm, heightMm, profitPercentage]);

  return (
    <div className="relative h-full w-full overflow-hidden border border-slate-300 bg-white shadow-2xl">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close configurator"
        className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex h-full">
        <div className="h-full flex-1 min-w-0 border-r border-slate-200 bg-white p-2">
          <div ref={canvasWrapRef} className="relative h-full min-h-[520px] w-full min-w-0">
            <div ref={containerRef} className="rounded-xl border border-gray-200 bg-[#F9FBFD] w-full overflow-hidden" style={{ width: "100%", height: stageSize.h }} />
            <div className="pointer-events-none absolute inset-0">
              {dimensionLabels.map((label) => (
                <input
                  key={label.id}
                  type="number"
                  value={label.value}
                  onChange={(e) => label.onChange(Number(e.target.value))}
                  onFocus={() => {
                    setSelectedId(label.selectId);
                    setSelectedSlidingPanelIndex(label.panelIndex ?? null);
                  }}
                  data-dim-input="true"
                  className="pointer-events-auto absolute h-7 w-[88px] rounded-sm border border-gray-400 bg-white text-center text-sm text-gray-900 shadow-sm focus:border-[#124657] focus:outline-none focus:ring-2 focus:ring-[#124657]"
                  style={{ left: label.x, top: label.y }}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute right-4 top-4 z-10 text-xs text-gray-500">Use the dimension boxes to edit sizes</div>
            <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white/95 p-2 shadow">
                <button type="button" onClick={undo} disabled={past.length === 0} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-50"><Undo2 className="h-4 w-4" /></button>
                <button type="button" onClick={redo} disabled={future.length === 0} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-50"><Redo2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => reset(buildPreset(baseSystemType, baseGlass, baseMesh))} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50"><RotateCcw className="h-4 w-4" /></button>
              </div>
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white/95 p-2 shadow">
                <label className="flex items-center gap-2 text-sm text-gray-700"><span>Split Count</span><select value={splitCount} onChange={(e) => setSplitCount(Number(e.target.value) || 2)} className="rounded-md border border-gray-400 px-2 py-1 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option></select></label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><span>Direction</span><select value={splitDirection} onChange={(e) => setSplitDirection(e.target.value as SplitDirection)} className="rounded-md border border-gray-400 px-2 py-1 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
                <button type="button" onClick={() => splitSelected(splitDirection)} disabled={selectedNode.systemType === "Sliding"} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">{splitDirection === "vertical" ? <SplitSquareVertical className="h-4 w-4" /> : <SplitSquareHorizontal className="h-4 w-4" />}Split</button>
                <button type="button" onClick={mergeSelected} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Square className="h-4 w-4" />Merge</button>
              </div>
            </div>
          </div>
        </div>
        {showSummaryPopup && (
          <div className="w-[380px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-5">
            <h4 className="mb-4 text-base font-semibold text-gray-900">Summary</h4>
            <div className="mb-5 rounded-lg border border-gray-200 p-3">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Quotation Fields</div>
              <div className="grid grid-cols-1 gap-3 text-sm">
                {isCombinationParentSelection ? (
                  <>
                    <label className="text-xs text-gray-600">Ref Code<input value={meta.refCode} onChange={(e) => setMeta((prev) => ({ ...prev, refCode: e.target.value }))} required className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                    <label className="text-xs text-gray-600">Location<input value={meta.location} placeholder="Living Room" onChange={(e) => setMeta((prev) => ({ ...prev, location: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                    <label className="text-xs text-gray-600">System<input value={COMBINATION_SYSTEM} readOnly className="mt-1 w-full rounded-md border border-gray-400 bg-gray-50 px-2 py-2 text-sm text-gray-600" /></label>
                    <label className="text-xs text-gray-600">Quantity<input type="number" min={1} value={meta.quantity} onChange={(e) => setMeta((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value) || 1) }))} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                    <label className="text-xs text-gray-600">Rate (Auto)<input value={parentCombinationRate} readOnly className="mt-1 w-full rounded-md border border-gray-400 bg-gray-50 px-2 py-2 text-sm text-gray-600" /></label>
                    <label className="text-xs text-gray-600">Remarks<textarea value={meta.remarks} onChange={(e) => setMeta((prev) => ({ ...prev, remarks: e.target.value }))} rows={2} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657] resize-none" /></label>
                  </>
                ) : (
                  <>
                    {isCombinationChildSelection ? (
                      <label className="text-xs text-gray-600">Ref Code (Auto)<input value={childAutoRef || "Will be generated from parent ref"} readOnly className="mt-1 w-full rounded-md border border-gray-400 bg-gray-50 px-2 py-2 text-sm text-gray-600" /></label>
                    ) : (
                      <>
                        <label className="text-xs text-gray-600">Ref Code<input value={meta.refCode} onChange={(e) => setMeta((prev) => ({ ...prev, refCode: e.target.value }))} required className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                        <label className="text-xs text-gray-600">Location<input value={meta.location} placeholder="Living Room" onChange={(e) => setMeta((prev) => ({ ...prev, location: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                      </>
                    )}
                    {isSlidingPanelSelection ? (
                      <label className="text-xs text-gray-600">Sliding Movement<select value={selectedNode.panelSashes && selectedNode.panelSashes.length === (selectedNode.panelFractions?.length ?? 0) && selectedSlidingPanelIndex !== null ? (selectedNode.panelSashes[selectedSlidingPanelIndex] ?? "fixed") : "fixed"} onChange={(e) => { const sash = e.target.value as SashType; if (selectedSlidingPanelIndex === null) return; updateSelectedNode((target) => { const panelCount = target.panelFractions?.length ?? 0; if (panelCount < 2) return; const nextSashes = target.panelSashes && target.panelSashes.length === panelCount ? [...target.panelSashes] : buildDefaultSlidingPanelSashes(panelCount); nextSashes[selectedSlidingPanelIndex] = sash; target.panelSashes = nextSashes; }); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="left">Left Sliding</option><option value="right">Right Sliding</option><option value="double">Both Ways</option><option value="fixed">Fixed</option></select></label>
                    ) : (
                      <>
                        <label className="text-xs text-gray-600">Section System<select value={selectedNode.systemType} onChange={(e) => { const nextSystem = e.target.value as SystemType; updateSelectedLeaves((target) => { target.systemType = nextSystem; target.series = ""; target.description = isLouverSystem(nextSystem) ? "Louvers" : isExhaustSystem(nextSystem) ? "Exhaust Fan" : ""; target.hasExhaustFan = isExhaustSystem(nextSystem); target.panelSashes = undefined; target.panelFractions = undefined; target.panelMeshCount = undefined; target.mesh = isLouverSystem(nextSystem) || isExhaustSystem(nextSystem) ? "No" : target.mesh; target.glass = isExhaustSystem(nextSystem) || isLouverSystem(nextSystem) ? "Yes" : target.glass; target.exhaustFanX = DEFAULT_EXHAUST_FAN_X; target.exhaustFanY = DEFAULT_EXHAUST_FAN_Y; target.exhaustFanSize = DEFAULT_EXHAUST_FAN_SIZE; if (nextSystem !== "Sliding" && (target.sash === "left" || target.sash === "right" || target.sash === "double")) target.sash = "fixed"; }); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]">{selectableSystemOptions.map((sys) => <option key={sys} value={sys}>{sys}</option>)}</select></label>
                        {selectedSystemSupportsCatalog && (
                          <>
                            <label className="text-xs text-gray-600">Section Series<select value={selectedNode.series} onChange={(e) => { const nextSeries = e.target.value; updateSelectedLeaves((target) => { target.series = nextSeries; target.description = ""; target.hasExhaustFan = false; target.panelFractions = undefined; target.panelMeshCount = undefined; target.panelSashes = undefined; }); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{seriesOptions.map((series) => <option key={series} value={series}>{series}</option>)}</select></label>
                            <label className="text-xs text-gray-600">Section Description<select value={selectedNode.description} onChange={(e) => { const nextDescription = e.target.value; updateSelectedSectionMeta({ meshType: "" }); if (selectedNode.systemType === "Sliding") { updateSelectedNode((target) => { target.description = nextDescription; target.hasExhaustFan = false; target.split = "none"; target.children = undefined; const pattern = parsePanelPattern(nextDescription); if (pattern) { target.panelFractions = pattern.fractions; target.panelMeshCount = pattern.meshCount; target.mesh = (pattern.meshCount ?? 0) > 0 ? "Yes" : "No"; target.panelSashes = target.panelSashes && target.panelSashes.length === pattern.fractions.length ? target.panelSashes : buildDefaultSlidingPanelSashes(pattern.fractions.length); } else { target.panelFractions = undefined; target.panelMeshCount = undefined; target.mesh = "No"; target.panelSashes = undefined; } }); return; } updateSelectedLeaves((target) => { target.description = nextDescription; target.hasExhaustFan = false; const pattern = parsePanelPattern(nextDescription); if (pattern) { target.panelFractions = pattern.fractions; target.panelMeshCount = pattern.meshCount; target.panelSashes = undefined; } else { target.panelFractions = undefined; target.panelMeshCount = undefined; target.panelSashes = undefined; } }); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{descriptionOptions.map((desc: Description) => <option key={desc.name} value={desc.name}>{desc.name}</option>)}</select></label>
                            <label className="text-xs text-gray-600">Section Glass<select value={selectedNode.glass} onChange={(e) => { const value = e.target.value as YesNo; updateSelectedLeaves((target) => { target.glass = value; }); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="Yes">Yes</option><option value="No">No</option></select></label>
                            <label className="text-xs text-gray-600">Section Mesh<select value={selectedNode.mesh} onChange={(e) => { if (selectedNode.systemType === "Sliding") return; const value = e.target.value as YesNo; updateSelectedLeaves((target) => { target.mesh = value; }); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" disabled={selectedNode.systemType === "Sliding"}><option value="No">No</option><option value="Yes">Yes</option></select></label>
                          </>
                        )}
                        {canInsertExhaustFan && <label className="text-xs text-gray-600">Exhaust Fan Insert<select value={selectedNode.hasExhaustFan ? "Yes" : "No"} onChange={(e) => { const shouldInsert = e.target.value === "Yes"; updateSelectedLeaves((target) => { target.hasExhaustFan = shouldInsert; target.glass = "Yes"; target.mesh = "No"; target.exhaustFanX = DEFAULT_EXHAUST_FAN_X; target.exhaustFanY = DEFAULT_EXHAUST_FAN_Y; target.exhaustFanSize = DEFAULT_EXHAUST_FAN_SIZE; }); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="No">No</option><option value="Yes">Yes</option></select><div className="mt-1 text-[11px] text-gray-500">Fixed glass section will include the exhaust fan cut-out.</div></label>}
                        {hasAdjustableExhaustFan && (
                          <>
                            <label className="text-xs text-gray-600">Fan Horizontal Position<input type="range" min={18} max={82} step={1} value={Math.round((selectedNode.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X) * 100)} onChange={(e) => { const value = Number(e.target.value) / 100; updateSelectedNode((target) => { target.exhaustFanX = clampValue(value, 0.18, 0.82); }); }} className="mt-2 w-full" /><div className="mt-1 text-[11px] text-gray-500">{Math.round((selectedNode.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X) * 100)}%</div></label>
                            <label className="text-xs text-gray-600">Fan Vertical Position<input type="range" min={18} max={82} step={1} value={Math.round((selectedNode.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y) * 100)} onChange={(e) => { const value = Number(e.target.value) / 100; updateSelectedNode((target) => { target.exhaustFanY = clampValue(value, 0.18, 0.82); }); }} className="mt-2 w-full" /><div className="mt-1 text-[11px] text-gray-500">{Math.round((selectedNode.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y) * 100)}%</div></label>
                            <label className="text-xs text-gray-600">Fan Size<input type="range" min={20} max={90} step={1} value={Math.round((selectedNode.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE) * 100)} onChange={(e) => { const value = Number(e.target.value) / 100; updateSelectedNode((target) => { target.exhaustFanSize = clampValue(value, 0.2, 0.9); }); }} className="mt-2 w-full" /><div className="mt-1 text-[11px] text-gray-500">{Math.round((selectedNode.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE) * 100)}%</div></label>
                          </>
                        )}
                        {selectedSystemSupportsCatalog && (
                          <>
                            <label className="text-xs text-gray-600">Color Finish<select value={selectedSectionMeta.colorFinish} onChange={(e) => updateSelectedSectionMeta({ colorFinish: e.target.value })} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{metaOptionsQuery.data?.colorFinishes.map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</select></label>
                            <label className="text-xs text-gray-600">Glass Spec<select value={selectedSectionMeta.glassSpec} onChange={(e) => updateSelectedSectionMeta({ glassSpec: e.target.value })} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{metaOptionsQuery.data?.glassSpecs.map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</select></label>
                            <label className="text-xs text-gray-600">Handle Type<select value={selectedSectionMeta.handleType} onChange={(e) => updateSelectedSectionMeta({ handleType: e.target.value, handleColor: "" })} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{metaOptionsQuery.data?.handleOptions.map((opt: HandleOption) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</select></label>
                            <label className="text-xs text-gray-600">Handle Color<select value={selectedSectionMeta.handleColor} onChange={(e) => updateSelectedSectionMeta({ handleColor: e.target.value })} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{(metaHandleOption?.colors ?? []).map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</select></label>
                          </>
                        )}
                        {selectedSystemSupportsCatalog && (!isCombinationChildSelection || selectedNode.systemType === "Sliding") && <label className="text-xs text-gray-600">Mesh Type<select value={selectedSectionMeta.meshType} onChange={(e) => updateSelectedSectionMeta({ meshType: e.target.value })} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" disabled={selectedNode.mesh !== "Yes"}><option value="">Select</option>{metaOptionsQuery.data?.meshTypes.map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</select></label>}
                        {isCombinationChildSelection ? (
                          <label className="text-xs text-gray-600">Rate<input type="number" min={0} value={selectedChildRate} onChange={(e) => { if (!selectedId) return; setManualChildRates((prev) => ({ ...prev, [selectedId]: Number(e.target.value) || 0 })); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /><div className="mt-1 text-[11px] text-gray-500">Section area: {selectedLeafAreaSqft.toFixed(2)} sqft</div></label>
                        ) : (
                          <>
                            <label className="text-xs text-gray-600">Quantity<input type="number" min={1} value={meta.quantity} onChange={(e) => setMeta((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value) || 1) }))} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                            <label className="text-xs text-gray-600">Rate<input type="number" min={0} value={meta.rate} onChange={(e) => { setIsManualRate(true); setMeta((prev) => ({ ...prev, rate: Number(e.target.value) || 0 })); }} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                            <label className="text-xs text-gray-600">Remarks<textarea value={meta.remarks} onChange={(e) => setMeta((prev) => ({ ...prev, remarks: e.target.value }))} rows={2} className="mt-1 w-full rounded-md border border-gray-400 px-2 py-2 text-sm focus:border-[#124657] focus:ring-2 focus:ring-[#124657] resize-none" /></label>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"><span className="text-gray-500">Width</span><span className="font-semibold">{widthMm} mm</span></div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"><span className="text-gray-500">Height</span><span className="font-semibold">{heightMm} mm</span></div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"><span className="text-gray-500">Area</span><span className="font-semibold">{areaSqft} sq ft</span></div>
              <div className="pt-2">
                <button type="button" onClick={handleSaveItem} disabled={isSaving} className="w-full rounded-lg bg-[#124657] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0b3642] disabled:opacity-60">{isSaving ? "Saving..." : initialItem ? "Update Item" : "Add to Quotation"}</button>
                <button type="button" onClick={onClose} className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
              <div className="text-xs text-gray-400">Selected: <span className="font-medium text-gray-600">{selectedId === null ? "None" : selectedNode.id === "root" ? "Whole Frame" : isSlidingPanelSelection ? `Sliding Panel ${selectedSlidingPanelIndex! + 1}` : "Section"}</span></div>
            </div>
          </div>
        )}
        {!showSummaryPopup && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-30">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
              <button type="button" onClick={handleSaveItem} disabled={isSaving} className="rounded-lg bg-[#124657] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3642] disabled:opacity-60">{isSaving ? "Saving..." : initialItem ? "Update Item" : "Add to Quotation"}</button>
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
