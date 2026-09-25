"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva/lib/index";
import {
  type KonvaLayer,
  type SectionNode,
  type SplitDirection,
  type SashType,
  type SystemType,
  type ArchType,
  type YesNo,
  type CutAngle,
  type ProductMeta,
  normalizeArchType,
  normalizeArchHeightRatio,
  clampValue,
  DEFAULT_ARCH_HEIGHT_RATIO,
  safeDrawSize,
  mapLeafNodes,
  buildDefaultSlidingPanelSashes,
  DEFAULT_EXHAUST_FAN_X,
  DEFAULT_EXHAUST_FAN_Y,
  DEFAULT_EXHAUST_FAN_SIZE,
  parsePanelPattern,
  getDefaultLeafDescription,
  isLouverSystem,
  resolveDividerValue,
  findNode,
  getArchTopRatioAtX,
  mapItemToConfiguratorState,
  COMBINATION_SYSTEM,
  createRoot,
  defaultCutAngleForSystem,
  resolveCutAngleForSystem,
  createLeaf,
  DEFAULT_GLASS_SPEC,
  DEFAULT_HANDLE_COLOR,
  resolveFrameColor,
  getEffectiveLeafHeightRatio,
  renderWindowDoorDesign,
  generateWindowDoorPreview,
} from "@/modules/product-configurator/utils/window-door-design";
import {
  Undo2,
  Redo2,
  SplitSquareVertical,
  SplitSquareHorizontal,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { descriptionsQueryOptions, optionsQueryOptions, useDescriptionsQuery, useOptionsQuery, useSeriesQuery, useSystemsQuery } from "@/lib/quotations/queries";
import type { Description, HandleOption, OptionWithRate, OptionsResponse } from "@/lib/quotations/types";
import type { QuotationItem, QuotationSubItem } from "@/components/QuotationItemRow";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchLouversRates } from "@/lib/quotations/api";
import { calculateQuotationRates, type RateCalculationResult } from "@/services/quotation-service";

type KonvaStage = InstanceType<typeof Konva.Stage>;

type SectionOptionMeta = Pick<
  ProductMeta,
  "colorFinish" | "glassSpec" | "hardwareOpeningType" | "handleType" | "handleColor" | "meshType"
>;

const DEFAULT_META: ProductMeta = {
  productType: "Window",
  systemType: "Casement",
  series: "",
  description: "",
  colorFinish: "",
  glassSpec: DEFAULT_GLASS_SPEC,
  hardwareOpeningType: "hinges",
  handleType: "",
  handleColor: DEFAULT_HANDLE_COLOR,
  meshPresent: "No",
  meshType: "",
  location: "",
  quantity: 1,
  refCode: "",
  remarks: "",
  rate: 0,
  frameCutAngle: "45",
  shutterCutAngle: "45",
};

const DEFAULT_SECTION_OPTION_META: SectionOptionMeta = {
  colorFinish: "",
  glassSpec: DEFAULT_GLASS_SPEC,
  hardwareOpeningType: "hinges",
  handleType: "",
  handleColor: DEFAULT_HANDLE_COLOR,
  meshType: "",
};

const getCuttingScheduleKey = (horizontalAngle: CutAngle, verticalAngle: CutAngle) =>
  `${horizontalAngle}_${verticalAngle}` as QuotationItem["cuttingScheduleKey"];

const AREA_SLABS = [
  { max: 20, index: 0 },
  { max: 40, index: 1 },
  { max: Infinity, index: 2 },
];

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

const isCatalogSystem = (systemType: string): systemType is Extract<SystemType, "Casement" | "Sliding" | "Slide N Fold"> =>
  CATALOG_SYSTEMS.has(systemType as SystemType);

const EXHAUST_FAN_RATE_SURCHARGE = 10;

const getPanelBounds = (x: number, y: number, w: number, h: number, inset: number) => {
  const safeW = safeDrawSize(w);
  const safeH = safeDrawSize(h);
  const insetX = Math.min(inset, Math.max(0, safeW / 2 - 0.5));
  const insetY = Math.min(inset, Math.max(0, safeH / 2 - 0.5));

  return {
    x: x + insetX,
    y: y + insetY,
    w: Math.max(1, safeW - insetX * 2),
    h: Math.max(1, safeH - insetY * 2),
  };
};

const buildPreset = (systemType: SystemType, glass: YesNo, mesh: YesNo): SectionNode => {
  const root: SectionNode = { ...createRoot(systemType), glass: "Yes", mesh };

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
    root.glass = "No";
    root.mesh = "No";
    root.sash = "fixed";
    return root;
  }

  if (systemType === "Blank Area") {
    root.description = "Blank Area";
    root.glass = "No";
    root.mesh = "No";
    root.sash = "fixed";
    root.hasExhaustFan = false;
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

type RequiredField = "refCode" | "series" | "description";

const findMissingSectionField = (root: SectionNode): { nodeId: string; field: RequiredField } | null => {
  let missing: { nodeId: string; field: RequiredField } | null = null;
  mapLeafNodes(root, (leaf) => {
    if (missing || !isCatalogSystem(leaf.systemType)) return;
    if (!leaf.series?.trim()) missing = { nodeId: leaf.id, field: "series" };
    else if (!leaf.description?.trim()) missing = { nodeId: leaf.id, field: "description" };
  });
  return missing;
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
      leaf.frameCutAngle = node.frameCutAngle;
      leaf.shutterCutAngle = node.shutterCutAngle;
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

const isFixedDescription = (description?: string) => /^(fix|fixed)$/i.test(description?.trim() ?? "");

const calculateRateForItem = (
  next: {
    area: number;
    systemType: string;
    description: string;
    colorFinish: string;
    glassSpec: string;
    handleType: string;
    handleColor: string;
    meshPresent: string;
    meshType: string;
    hasExhaustFan?: boolean;
  },
  descriptions: Description[] | undefined,
  options: OptionsResponse | undefined,
  systems: any[] | undefined,
  louversRates: number[] | undefined,
  calculatedBaseRate?: number
) => {
  let baseRates: number[] = [];
  let desc: any = null;
  if (next.systemType === "Louvers" || next.description === "Louvers") {
    baseRates = louversRates || [];
  } else {
    desc = descriptions?.find(
      (d: any) => d.name === next.description
    );
    baseRates = desc?.baseRates ?? [];
  }
  const slab = AREA_SLABS.find((s) => next.area <= s.max);
  const slabIndex = slab ? slab.index : 0;
  const baseRate = calculatedBaseRate ?? baseRates[slabIndex] ?? 0;
  if (next.systemType === "Louvers") {
    return {
      rate: 500,
      handleCount: 0,
      baseRate: 500,
      areaSlabIndex: slab?.index ?? 0,
    };
  }
  console.log("FINAL DEBUG", {
    area: next.area,
    slabIndex,
    baseRates,
    baseRate
  });
  const colorRate = options?.colorFinishes.find((c) => c.name === next.colorFinish)?.rate ?? 0;
  const meshRate =
    next.meshPresent === "Yes"
      ? options?.meshTypes.find((m) => m.name === next.meshType)?.rate ?? 0
      : 0;
  const glassRate = options?.glassSpecs.find((g) => g.name === next.glassSpec)?.rate ?? 0;
  const handleOpt = options?.handleOptions.find((h) => h.name === next.handleType);
  const handleCount = isFixedDescription(next.description) ? 0 : (desc?.defaultHandleCount ?? 0);
  const handleUnitRate = handleOpt?.colors.find((c) => c.name === next.handleColor)?.rate ?? 0;
  const handleRate = handleCount > 0 ? (handleCount * handleUnitRate) / (next.area || 1) : 0;

  return {
    rate: baseRate + colorRate + meshRate + glassRate + handleRate + (next.hasExhaustFan ? EXHAUST_FAN_RATE_SURCHARGE : 0),
    handleCount,
    baseRate,
    areaSlabIndex: slab?.index ?? 0,
  };
};

function RateCalculationAction({
  isCalculating,
  error,
  isStale,
  result,
  onCalculate,
}: {
  isCalculating: boolean;
  error: string;
  isStale: boolean;
  result?: RateCalculationResult | null;
  onCalculate: () => Promise<void>;
}) {
  return (
    <div className="col-span-full space-y-1">
      <button
        type="button"
        onClick={() => void onCalculate()}
        disabled={isCalculating}
        className="w-full rounded-md bg-[#0f172A] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCalculating ? "Calculating…" : "Calculate Rate"}
      </button>
      {error && <div className="text-xs text-red-600">{error}</div>}
      {isStale && <div className="text-xs text-amber-600">Inputs changed — recalculate rate.</div>}
    </div>
  );
}

function DimensionTextInput({
  value,
  onChange,
  onFocus,
}: {
  value: number;
  onChange: (value: number) => void;
  onFocus: () => void;
}) {
  const [textValue, setTextValue] = useState(String(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) setTextValue(String(value));
  }, [value]);

  const commitValue = () => {
    const parsed = Number(textValue);
    if (textValue.trim() !== "" && Number.isFinite(parsed)) {
      onChange(parsed);
      setTextValue(String(Math.round(parsed)));
    } else {
      setTextValue(String(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={textValue}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*(?:\.\d*)?$/.test(next)) return;
        setTextValue(next);
        if (next.trim() !== "") onChange(Number(next));
      }}
      onFocus={(event) => {
        isFocusedRef.current = true;
        onFocus();
        event.currentTarget.select();
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        commitValue();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      onClick={(event) => event.currentTarget.select()}
      data-dim-input="true"
      className="h-7 w-[88px] rounded-sm border border-gray-400 bg-white text-center text-sm text-gray-900 shadow-sm focus:border-[#124657] focus:outline-none focus:ring-2 focus:ring-[#124657]"
    />
  );
}

// Remaining helpers and component body continue exactly in the same working flow,
// adapted only for the local repo types and imports.

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

function validFrameColor(value?: string, colorFinishName?: string) {
  return resolveFrameColor(colorFinishName, value);
}

export function WindowDoorConfigurator({
  onSaveItem,
  onClose,
  initialItem,
  profitPercentage,
}: {
  onSaveItem: (item: QuotationItem) => Promise<void> | void;
  onClose: () => void;
  initialItem?: QuotationItem | null;
  profitPercentage: number;
}) {
  const queryClient = useQueryClient();
  const fetchDescriptions = useCallback(
    (systemType: string, series: string) => queryClient.ensureQueryData(descriptionsQueryOptions(systemType, series)),
    [queryClient]
  );
  const fetchOptions = useCallback(
    (systemType: string) => queryClient.ensureQueryData(optionsQueryOptions(systemType)),
    [queryClient]
  );
  const persistedItem = initialItem ?? null;
  const isBlankAddItem = Boolean(
    persistedItem &&
    !persistedItem.refCode &&
    !persistedItem.systemType &&
    !persistedItem.description &&
    !persistedItem.configuratorLayout
  );
  const editingItem = persistedItem && !isBlankAddItem && persistedItem.configuratorStep !== "draft"
    ? persistedItem
    : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage | null>(null);
  const layerRef = useRef<KonvaLayer | null>(null);
  // const gridGroupRef = useRef<KonvaGroup | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const { data: systems } = useSystemsQuery();
  console.log("SYSTEMS", systems);
  const [selectedDivider, setSelectedDivider] = useState<{
    id: string;
    leftId: string;
    rightId: string;
  } | null>(null);

  const [badgeValues, setBadgeValues] = useState<Record<string, "C" | "M">>({});
  const dividerBadgesRef = useRef<
    {
      id: string;
      leftId: string;
      rightId: string;
      orientation: "vertical" | "horizontal";
    }[]
  >([]);
  const [editingDimensions, setEditingDimensions] = useState<Record<string, string>>({});

  const [selectedId, setSelectedId] = useState<string | null>("root");
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
  const [isRetryingLookups, setIsRetryingLookups] = useState(false);
  const [lookupLoadError, setLookupLoadError] = useState("");
  const hideSelectionForExport = false;
  const [manualChildRates, setManualChildRates] = useState<Record<string, number>>({});
  const [autoChildRates, setAutoChildRates] = useState<Record<string, number>>({});
  const [childSectionMeta, setChildSectionMeta] = useState<Record<string, SectionOptionMeta>>({});
  const [isManualRate, setIsManualRate] = useState(false);
  const previousSystemTypeRef = useRef<SystemType>(DEFAULT_META.systemType as SystemType);
  const [isCalculatingRate, setIsCalculatingRate] = useState(false);
  const [rateCalculationError, setRateCalculationError] = useState("");
  const [singleRateCalculation, setSingleRateCalculation] = useState<RateCalculationResult | null>(null);
  const [childRateCalculations, setChildRateCalculations] = useState<Record<string, RateCalculationResult>>({});
  const [rateIsStale, setRateIsStale] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ w: 1200, h: 780 });
  const { past, future, present, push, setDirect, undo, redo, reset } = useHistory(buildPreset(DEFAULT_META.systemType as SystemType, "Yes", "No"));
  const root = present;
  const selectedNode = (selectedId ? findNode(root, selectedId) : null) ?? root;
  const selectedNodeIsPureCasement = useMemo(() => {
    const systems = new Set<SystemType>();

    mapLeafNodes(selectedNode, (leaf) => {
      systems.add(leaf.systemType);
    });

    return systems.size === 1 && systems.has("Casement");
  }, [selectedNode]);
  // useEffect(() => {
  //   if (selectedNodeIsPureCasement) {
  //     setMeta((prev) => ({
  //       ...prev,
  //       frameCutAngle: "45",
  //       shutterCutAngle: "45",
  //     }));
  //   }
  // }, [selectedNodeIsPureCasement]);
  const selectedSystemSupportsCatalog = isCatalogSystem(selectedNode.systemType);
  const canInsertExhaustFan = selectedNode.systemType === "Casement" && selectedNode.description === "Fix" && !selectedNode.children?.length;
  const hasAdjustableExhaustFan = !selectedNode.children?.length && Boolean(selectedNode.hasExhaustFan);
  const isSlidingPanelSelection = selectedNode.systemType === "Sliding" && !selectedNode.children?.length && (selectedNode.panelFractions?.length ?? 0) > 1 && selectedSlidingPanelIndex !== null && selectedSlidingPanelIndex >= 0 && selectedSlidingPanelIndex < (selectedNode.panelFractions?.length ?? 0);
  const showSummaryPopup = selectedId !== null || selectedDivider !== null;
  const systemsQuery = useSystemsQuery();
  const selectedSeriesQuery = useSeriesQuery(selectedSystemSupportsCatalog ? selectedNode.systemType : "");
  const selectedDescriptionsQuery = useDescriptionsQuery(selectedSystemSupportsCatalog ? selectedNode.systemType : "", selectedSystemSupportsCatalog ? selectedNode.series : "");
  const optionsSystemType = selectedSystemSupportsCatalog ? selectedNode.systemType || baseSystemType : "";
  const metaOptionsQuery = useOptionsQuery(optionsSystemType);
  const combinationOptionsQuery = useOptionsQuery(baseSystemType);
  const systemOptions = Array.from(new Set([...(systemsQuery.data?.systems ?? ["Casement", "Sliding", "Slide N Fold"]).filter((sys) => sys !== "Exhaust Fan"), "Louvers"]));
  const selectableSystemOptions = systemOptions.filter((sys): sys is SystemType => sys === "Casement" || sys === "Sliding" || sys === "Slide N Fold" || sys === "Louvers");
  const seriesOptions = selectedSeriesQuery.data?.series ?? [];
  const descriptionOptions = selectedDescriptionsQuery.data?.descriptions ?? [];
  const { data: louversRates } = useQuery({
    queryKey: ["louvers-rates"],
    queryFn: fetchLouversRates,
    enabled: true,
  });

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
    const labels: Array<{ id: string; x: number; y: number; value: number; selectId: string | null; panelIndex?: number; staticValue?: number; onChange: (next: number) => void }> = [];
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
    const isRootArched = normalizeArchType(root.archType) !== "none";
    const sideTopRatio = isRootArched ? getArchTopRatioAtX(root.archType, root.archHeightRatio, 0) : 0;
    const mainHeightGuideX = fx - horizontalGuideBase - (maxHorizontalLevel >= 0 ? (maxHorizontalLevel + 1) * hierarchyOffset : 26);
    const hMidY = (fy + sideTopRatio * fh + fy + fh) / 2;
    const effectiveSideHeight = Math.round(heightMm * (1 - sideTopRatio));
    labels.push({ id: "height", x: clampX(mainHeightGuideX - 44), y: clampY(hMidY - 14), value: heightMm, staticValue: isRootArched ? effectiveSideHeight : undefined, selectId: "root", onChange: (next) => setHeightMm(clampMm(next, 0, 100000)) });
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

    // Nested splits and narrow panels can put several 88px inputs at almost
    // the same coordinate. Pack colliding width labels into separate rows and
    // height labels into separate columns while keeping every box on-canvas.
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const overlapsPlaced = (rect: { x: number; y: number; w: number; h: number }) =>
      placed.some((other) =>
        rect.x < other.x + other.w + 6 &&
        rect.x + rect.w + 6 > other.x &&
        rect.y < other.y + other.h + 6 &&
        rect.y + rect.h + 6 > other.y
      );
    const alternatingOffsets = (step: number, count: number) => {
      const offsets = [0];
      for (let index = 1; index <= count; index += 1) {
        offsets.push(index * step, -index * step);
      }
      return offsets;
    };
    const rowOffsets = alternatingOffsets(boxH + 8, 8);
    const columnOffsets = alternatingOffsets(boxW + 8, 6);

    return labels.map((label) => {
      const labelHeight = label.staticValue === undefined ? boxH : boxH + 24;
      const isHeightLabel = label.id === "height" || label.id.startsWith("sub-h-");
      const primaryOffsets = isHeightLabel ? columnOffsets : rowOffsets;
      const secondaryOffsets = isHeightLabel ? rowOffsets : columnOffsets;
      let resolvedX = clampX(label.x);
      let resolvedY = clampY(label.y);
      let found = false;

      for (const primary of primaryOffsets) {
        for (const secondary of secondaryOffsets) {
          const candidateX = clampX(label.x + (isHeightLabel ? primary : secondary));
          const candidateY = Math.max(
            0,
            Math.min(label.y + (isHeightLabel ? secondary : primary), stageSize.h - labelHeight)
          );
          const candidate = { x: candidateX, y: candidateY, w: boxW, h: labelHeight };
          if (!overlapsPlaced(candidate)) {
            resolvedX = candidateX;
            resolvedY = candidateY;
            placed.push(candidate);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        placed.push({ x: resolvedX, y: resolvedY, w: boxW, h: labelHeight });
      }
      return { ...label, x: resolvedX, y: resolvedY };
    });
  }, [heightMm, root, stageSize, updateChildDimension, updateLeafPanelDimension, view, widthMm]);

  // const areaSqft = useMemo(() => mmToSqft(widthMm, heightMm), [widthMm, heightMm]);
  const effectiveAreaSqft = useMemo(() => {
    let total = 0;

    mapLeafNodes(root, (leaf) => {
      if (leaf.systemType === "Blank Area") return;

      const leafArea = mmToSqft(leaf.w * widthMm, leaf.h * heightMm);
      total += leafArea;
    });

    return Number(total.toFixed(2));
  }, [root, widthMm, heightMm]);

  const leafNodesForMode = useMemo(() => {
    const leaves: SectionNode[] = [];
    mapLeafNodes(root, (leaf) => leaves.push(leaf));
    return leaves.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }, [root]);
  // Load every section's lookup data while editing and keep it observed until
  // the configurator closes. Saving reuses this snapshot even after staleTime.
  const lookupSections = Array.from(new Map(
    leafNodesForMode
      .filter((leaf) => leaf.systemType !== "Blank Area")
      .map((leaf) => {
        const series = isLouverSystem(leaf.systemType) ? "_" : leaf.series || "";
        return [JSON.stringify([leaf.systemType, series]), { systemType: leaf.systemType, series }] as const;
      })
  ).values());
  const saveDescriptionsQueries = useQueries({
    queries: lookupSections.map(({ systemType, series }) => ({
      ...descriptionsQueryOptions(systemType, series),
      enabled: Boolean(series),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });
  const saveOptionsQueries = useQueries({
    queries: Array.from(new Set(lookupSections.map(({ systemType }) => systemType))).map((systemType) => ({
      ...optionsQueryOptions(systemType),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });
  const saveLookupsReady = [...saveDescriptionsQueries, ...saveOptionsQueries]
    .every((query) => query.isSuccess && !query.isFetching);
  const saveLookupsFailed = [...saveDescriptionsQueries, ...saveOptionsQueries]
    .some((query) => query.isError);
  const isCombinationDraft = leafNodesForMode.length > 1;
  const selectedIsWholeFrame = selectedId === null || selectedNode.id === "root";
  const isCombinationParentSelection = isCombinationDraft && selectedIsWholeFrame;
  const isCombinationChildSelection = isCombinationDraft && !selectedIsWholeFrame;
  const canConfigureArch = selectedIsWholeFrame && leafNodesForMode.length > 0 && leafNodesForMode.every((leaf) => leaf.systemType === "Casement");
  const selectedLeafIndex = leafNodesForMode.findIndex((leaf) => leaf.id === selectedNode.id);
  const selectedSectionMeta: SectionOptionMeta = isCombinationChildSelection && selectedId ? (childSectionMeta[selectedId] ?? DEFAULT_SECTION_OPTION_META) : { colorFinish: meta.colorFinish, glassSpec: meta.glassSpec, hardwareOpeningType: meta.hardwareOpeningType, handleType: meta.handleType, handleColor: meta.handleColor, meshType: meta.meshType };
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
  const selectedLeafAreaSqft =
    isCombinationChildSelection && selectedLeafIndex >= 0
      ? (
        leafNodesForMode[selectedLeafIndex].systemType === "Blank Area" ||
        leafNodesForMode[selectedLeafIndex].description === "Blank Area"
      )
        ? 0
        : mmToSqft(
          leafNodesForMode[selectedLeafIndex].w * widthMm,
          getEffectiveLeafHeightRatio(root, leafNodesForMode[selectedLeafIndex]) * heightMm
        )
      : 0;

  const calculateLeafRate = async (
    leaf: SectionNode,
    sectionMeta: SectionOptionMeta,
    width: number,
    height: number,
    area: number
  ) => {
    const louver = isLouverSystem(leaf.systemType);
    const series = louver ? "" : leaf.series || "";
    const description = louver ? "" : leaf.description || getDefaultLeafDescription(leaf.systemType, meta.productType, leaf.hasExhaustFan);
    if (!louver && (!series || !description)) {
      throw new Error("Select a series and description before calculating the rate.");
    }
    const frameCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.frameCutAngle);
    const shutterCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.shutterCutAngle);

    const cuttingScheduleKey = getCuttingScheduleKey(
      frameCutAngle,
      shutterCutAngle
    );
    const [result] = await calculateQuotationRates([{
      clientId: leaf.id,
      systemType: leaf.systemType,
      series,
      description,
      width,
      height,
      area,
      frameCutAngle,
      shutterCutAngle,
      cuttingScheduleKey: String(cuttingScheduleKey),
      glassSpec: leaf.glass === "Yes" ? (sectionMeta.glassSpec || "Yes") : "",
      hardwareOpeningType: leaf.systemType === "Casement" ? sectionMeta.hardwareOpeningType : "",
    }]);
    const [descriptionsResp, optionsResp] = await Promise.all([
      fetchDescriptions(leaf.systemType, louver ? "_" : series),
      fetchOptions(leaf.systemType),
    ]);
    const calc = calculateRateForItem({
      area,
      systemType: leaf.systemType,
      description,
      colorFinish: meta.colorFinish,
      glassSpec: leaf.glass === "Yes" ? (sectionMeta.glassSpec || "Yes") : "",
      handleType: sectionMeta.handleType,
      handleColor: sectionMeta.handleColor,
      meshPresent: leaf.mesh,
      meshType: leaf.mesh === "Yes" ? sectionMeta.meshType : "",
      hasExhaustFan: Boolean(leaf.hasExhaustFan),
    }, descriptionsResp.descriptions, optionsResp, systemsQuery.data?.systems, louversRates, result.baseRate);
    return { rate: roundToTwo(calc.rate), result };
  };

  const calculateCombinationRate = async (manualSectionRate?: number) => {
    const leaves = leafNodesForMode.filter((leaf) => leaf.systemType !== "Blank Area");
    if (!leaves.length) throw new Error("Combination has no priceable sub-items.");
    const inputs = leaves.map((leaf) => {
      const height = getEffectiveLeafHeightRatio(root, leaf) * heightMm;
      const area = mmToSqft(leaf.w * widthMm, height);
      const louver = isLouverSystem(leaf.systemType);
      const series = louver ? "" : leaf.series || "";
      const description = louver ? "" : leaf.description || getDefaultLeafDescription(leaf.systemType, meta.productType, leaf.hasExhaustFan);
      const frameCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.frameCutAngle);
      const shutterCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.shutterCutAngle);
      if (!louver && (!series || !description)) throw new Error("Select a series and description for every sub-item before calculating the rate.");
      return {
        leaf,
        height,
        area,
        series,
        description,
      };
    });
    const regularRequests = inputs.map(({ leaf, height, area, series, description }) => {
      const frameCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.frameCutAngle);
      const shutterCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.shutterCutAngle);

      return {

        clientId: leaf.id,
        systemType: leaf.systemType,
        series,
        description,
        width: leaf.w * widthMm,
        height,
        area,
        frameCutAngle,
        shutterCutAngle,
        cuttingScheduleKey: String(
          getCuttingScheduleKey(
            frameCutAngle,
            shutterCutAngle
          )
        ),
        glassSpec: leaf.glass === "Yes" ? (getLeafSectionMeta(leaf.id).glassSpec || "Yes") : "",
        hardwareOpeningType: leaf.systemType === "Casement" ? getLeafSectionMeta(leaf.id).hardwareOpeningType : "",
      }
    });
    const joinRequests = dividerBadgesRef.current.map((badge, index) => {
      const source = findNode(root, badge.leftId) || leaves[0];
      const dividerValue = resolveDividerValue(
        root,
        badge.leftId,
        badge.rightId,
        badgeValues[badge.id]
      );
      return {
        clientId: `__join__${index}`,
        itemType: "join" as const,
        joinType: dividerValue === "M" ? "Mullion" as const : "Coupler" as const,
        joinOrientation: badge.orientation,
        systemType: source.systemType,
        series: source.series || "",
        description: dividerValue === "M" ? "Mullion" : "Coupler",
        width: widthMm,
        height: heightMm,
        area: effectiveAreaSqft,
        frameCutAngle: resolveCutAngleForSystem(source?.systemType || "", source?.frameCutAngle),
        shutterCutAngle: resolveCutAngleForSystem(source?.systemType || "", source?.shutterCutAngle),
        cuttingScheduleKey: String(
          getCuttingScheduleKey(
            resolveCutAngleForSystem(source?.systemType || "", source?.frameCutAngle),
            resolveCutAngleForSystem(source?.systemType || "", source?.shutterCutAngle)
          )
        ),
      };
    }).filter((request) => request.series);
    const materialResults = await calculateQuotationRates([...regularRequests, ...joinRequests]);
    const materialById = new Map(materialResults.map((result) => [result.clientId, result]));
    const joinResults = materialResults.filter((result) => result.clientId.startsWith("__join__"));
    const calculated = await Promise.all(inputs.map(async ({ leaf, area, series, description }) => {
      const result = materialById.get(leaf.id);
      if (!result) throw new Error(`Rate calculation returned no result for ${description}.`);
      const sectionMeta = getLeafSectionMeta(leaf.id);
      const [descriptionsResp, optionsResp] = await Promise.all([
        fetchDescriptions(leaf.systemType, isLouverSystem(leaf.systemType) ? "_" : series),
        fetchOptions(leaf.systemType),
      ]);
      const calc = calculateRateForItem({
        area,
        systemType: leaf.systemType,
        description,
        colorFinish: meta.colorFinish,
        glassSpec: leaf.glass === "Yes" ? (sectionMeta.glassSpec || "Yes") : "",
        handleType: sectionMeta.handleType,
        handleColor: sectionMeta.handleColor,
        meshPresent: leaf.mesh,
        meshType: leaf.mesh === "Yes" ? sectionMeta.meshType : "",
        hasExhaustFan: Boolean(leaf.hasExhaustFan),
      }, descriptionsResp.descriptions, optionsResp, systemsQuery.data?.systems, louversRates, result.baseRate);
      const rate = manualSectionRate !== undefined
        ? roundToTwo(manualSectionRate)
        : roundToTwo(calc.rate);
      return { leaf, area, rate, result };
    }));
    const joinMaterialValue = joinResults.reduce((sum, result) => sum + result.materialValue, 0);
    const sectionMaterialValue = calculated.reduce(
      (sum, entry) => sum + entry.rate * entry.area,
      0
    );
    const rate = roundToTwo(
      (effectiveAreaSqft > 0 ? sectionMaterialValue / effectiveAreaSqft : 0) +
      (effectiveAreaSqft > 0 ? joinMaterialValue / effectiveAreaSqft : 0)
    );
    const details = Object.fromEntries(
      calculated.map((entry) => [entry.leaf.id, entry.result])
    );
    const rates = Object.fromEntries(
      calculated.map((entry) => [entry.leaf.id, entry.rate])
    );
    const first = calculated[0].result;
    const aggregate: RateCalculationResult = {
      ...first,
      clientId: "combination-parent",
      baseRate: roundToTwo(
        effectiveAreaSqft > 0
          ? calculated.reduce((sum, entry) => sum + entry.result.baseRate * entry.area, 0) / effectiveAreaSqft
          : 0
      ),
      materialValue: roundToTwo(calculated.reduce((sum, entry) => sum + entry.result.materialValue, 0) + joinMaterialValue),
      area: roundToTwo(calculated.reduce((sum, entry) => sum + entry.result.area, 0)),
      totalWeightKg: roundToTwo(calculated.reduce((sum, entry) => sum + entry.result.totalWeightKg, 0) + joinResults.reduce((sum, result) => sum + result.totalWeightKg, 0)),
      warnings: [...calculated.flatMap((entry) => entry.result.warnings), ...joinResults.flatMap((result) => result.warnings)],
    };
    return { rate, aggregate, details, rates };
  };

  const handleCalculateRate = async () => {
    if (isCombinationDraft) {
      setIsCalculatingRate(true);
      setRateCalculationError("");
      try {
        const calculated = await calculateCombinationRate();
        setAutoChildRates(calculated.rates);
        setManualChildRates({});
        setChildRateCalculations(calculated.details);
        setMeta((prev) => ({ ...prev, rate: calculated.rate }));
        setSingleRateCalculation(calculated.aggregate);
        setIsManualRate(false);
        setRateIsStale(false);
      } catch (error) {
        const message = error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || "Unable to calculate rate")
          : error instanceof Error ? error.message : "Unable to calculate rate";
        setRateCalculationError(message);
      } finally {
        setIsCalculatingRate(false);
      }
      return;
    }
    const leaf = isCombinationChildSelection ? selectedNode : leafNodesForMode[0];
    if (!leaf || leaf.systemType === "Blank Area") return;
    const sectionMeta = isCombinationChildSelection ? getLeafSectionMeta(leaf.id) : selectedSectionMeta;
    const width = isCombinationChildSelection ? leaf.w * widthMm : widthMm;
    const height = isCombinationChildSelection
      ? getEffectiveLeafHeightRatio(root, leaf) * heightMm
      : heightMm;
    const area = isCombinationChildSelection ? selectedLeafAreaSqft : effectiveAreaSqft;
    setIsCalculatingRate(true);
    setRateCalculationError("");
    try {
      const { rate, result } = await calculateLeafRate(leaf, sectionMeta, width, height, area);

      if (isCombinationChildSelection && selectedId) {
        setAutoChildRates((prev) => ({ ...prev, [selectedId]: rate }));
        setManualChildRates((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
        setChildRateCalculations((prev) => ({ ...prev, [selectedId]: result }));
      } else {
        setMeta((prev) => ({ ...prev, rate }));
        setIsManualRate(false);
        setSingleRateCalculation(result);
      }
      setRateIsStale(false);
    } catch (error) {
      const message = error && typeof error === "object" && "response" in error
        ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || "Unable to calculate rate")
        : error instanceof Error ? error.message : "Unable to calculate rate";
      setRateCalculationError(message);
    } finally {
      setIsCalculatingRate(false);
    }
  };

  useEffect(() => {
    if (singleRateCalculation || Object.keys(childRateCalculations).length > 0) {
      setRateIsStale(true);
    }
  }, [widthMm, heightMm, root, meta.colorFinish, meta.glassSpec, meta.hardwareOpeningType, meta.handleType, meta.handleColor, meta.meshType, childSectionMeta]);


  useEffect(() => {
    if (isCombinationDraft) return;
    if (isManualRate) return;
    const run = async () => {
      const systemType = selectedNode.systemType;
      const series = selectedNode.series || "";

      const description =
        selectedNode.description ||
        getDefaultLeafDescription(
          systemType,
          meta.productType,
          selectedNode.hasExhaustFan
        );
      if (
        !systemType ||
        !description ||
        (isCatalogSystem(systemType) && !series)
      ) {
        return;
      }
      const [descriptionsResp, optionsResp] = await Promise.all([
        isCatalogSystem(systemType)
          ? fetchDescriptions(systemType, series)
          : Promise.resolve({ descriptions: [] }),

        fetchOptions(systemType),
      ]);
      const calc = calculateRateForItem(
        {
          area: effectiveAreaSqft,
          systemType: selectedNode.systemType,
          description,
          colorFinish: selectedSectionMeta.colorFinish,
          glassSpec:
            selectedNode.glass === "Yes"
              ? (selectedSectionMeta.glassSpec || "Yes")
              : "",
          handleType: selectedSectionMeta.handleType,
          handleColor: selectedSectionMeta.handleColor,
          meshPresent: selectedNode.mesh,
          meshType:
            selectedNode.mesh === "Yes"
              ? selectedSectionMeta.meshType
              : "",
        },
        descriptionsResp.descriptions,
        optionsResp,
        systemsQuery.data?.systems,
        louversRates
      );
      setMeta((prev) => {
        if (prev.rate === calc.rate) return prev;

        return {
          ...prev,
          rate: calc.rate,
        };
      });

    };

    void run();

  }, [
    isCombinationDraft,
    isManualRate,
    effectiveAreaSqft,

    selectedNode.systemType,
    selectedNode.series,
    selectedNode.description,
    selectedNode.glass,
    selectedNode.mesh,
    selectedNode.hasExhaustFan,

    selectedSectionMeta.colorFinish,
    selectedSectionMeta.glassSpec,
    selectedSectionMeta.handleType,
    selectedSectionMeta.handleColor,
    selectedSectionMeta.meshType,

    meta.productType,
    systemsQuery.data?.systems,
    louversRates,
  ]);

  const requiredFieldRefs = useRef<Partial<Record<RequiredField, HTMLLabelElement | null>>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [validationTarget, setValidationTarget] = useState<{ nodeId: string; field: RequiredField } | null>(null);
  const missingRequiredField = !meta.refCode.trim()
    ? { nodeId: root.id, field: "refCode" as const }
    : findMissingSectionField(root);
  const validationStillMissing = validationTarget && (validationTarget.field === "refCode"
    ? !meta.refCode.trim()
    : !findNode(root, validationTarget.nodeId)?.[validationTarget.field]?.trim());
  const requiredFieldProps = (field: RequiredField) => ({
    ref: (element: HTMLLabelElement | null) => { requiredFieldRefs.current[field] = element; },
    "data-configurator-invalid": Boolean(validationStillMissing && validationTarget?.field === field && validationTarget.nodeId === selectedNode.id),
  });

  useEffect(() => {
    if (!validationTarget || !validationStillMissing) return;
    const frame = requestAnimationFrame(() => {
      const label = requiredFieldRefs.current[validationTarget.field];
      if (!label) return;
      label.scrollIntoView({ behavior: "smooth", block: "center" });
      const control = label.querySelector<HTMLElement>("input, button, select");
      control?.focus({ preventScroll: true });
      control?.setAttribute("aria-invalid", "true");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        label.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], { duration: 300 });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      requiredFieldRefs.current[validationTarget.field]?.querySelector("[aria-invalid]")?.removeAttribute("aria-invalid");
    };
  }, [validationAttempt, validationTarget, validationStillMissing, selectedNode.id]);

  const handleSaveItem = async () => {
    if (isSaving || isRetryingLookups) return;
    if (missingRequiredField) {
      setSelectedDivider(null);
      setSelectedSlidingPanelIndex(null);
      setSelectedId(missingRequiredField.nodeId);
      setValidationTarget(missingRequiredField);
      setValidationAttempt((attempt) => attempt + 1);
      return;
    }
    if (saveLookupsFailed) {
      setIsRetryingLookups(true);
      setLookupLoadError("");
      try {
        const results = await Promise.all([...saveDescriptionsQueries, ...saveOptionsQueries]
          .filter((query) => query.isError)
          .map((query) => query.refetch()));
        if (results.some((result) => result.isError)) {
          setLookupLoadError("Could not load product options. Check your connection and try again.");
          return;
        }
      } catch {
        setLookupLoadError("Could not load product options. Check your connection and try again.");
        return;
      } finally {
        setIsRetryingLookups(false);
      }
      // Continue saving on the same click once all failed lookups recover.
    }
    if (!saveLookupsReady && !saveLookupsFailed) return;
    setLookupLoadError("");
    const trimmedRefCode = meta.refCode.trim();
    const firstLeaf = leafNodesForMode[0];

    const itemFrameCutAngle = isCombinationDraft
      ? resolveCutAngleForSystem(firstLeaf?.systemType || "", firstLeaf?.frameCutAngle)
      : resolveCutAngleForSystem(selectedNode.systemType, selectedNode.frameCutAngle);
    const itemShutterCutAngle = isCombinationDraft
      ? resolveCutAngleForSystem(firstLeaf?.systemType || "", firstLeaf?.shutterCutAngle)
      : resolveCutAngleForSystem(selectedNode.systemType, selectedNode.shutterCutAngle);

    const itemCuttingScheduleKey = getCuttingScheduleKey(
      itemFrameCutAngle,
      itemShutterCutAngle
    );
    const calculatedRatesForSave: Record<string, number> = {};
    const calculatedDetailsForSave: Record<string, RateCalculationResult> = {};
    let manualCombinationRateForSave = false;
    let calculatedSingleRateForSave: number | null = null;
    let calculatedSingleDetailsForSave: RateCalculationResult | null = null;
    let calculatedParentRateForSave: number | null = null;
    setIsSaving(true);
    try {
      setRateCalculationError("");
      if (isCombinationDraft && isManualRate && (Number(meta.rate) || 0) > 0) {
        const calculated = await calculateCombinationRate(Number(meta.rate));
        Object.assign(calculatedRatesForSave, calculated.rates);
        Object.assign(calculatedDetailsForSave, calculated.details);
        calculatedParentRateForSave = calculated.rate;
        calculatedSingleDetailsForSave = calculated.aggregate;
        manualCombinationRateForSave = true;
        setManualChildRates(calculated.rates);
        setAutoChildRates({});
        setChildRateCalculations(calculated.details);
        setMeta((prev) => ({ ...prev, rate: calculated.rate }));
        setSingleRateCalculation(calculated.aggregate);
      } else if (isCombinationDraft && (Number(meta.rate) || 0) <= 0) {
        const calculated = await calculateCombinationRate();
        Object.assign(calculatedRatesForSave, calculated.rates);
        Object.assign(calculatedDetailsForSave, calculated.details);
        calculatedParentRateForSave = calculated.rate;
        calculatedSingleDetailsForSave = calculated.aggregate;
        setAutoChildRates(calculated.rates);
        setManualChildRates({});
        setChildRateCalculations(calculated.details);
        setMeta((prev) => ({ ...prev, rate: calculated.rate }));
        setSingleRateCalculation(calculated.aggregate);
        setIsManualRate(false);
      } else if (!isManualRate || (Number(meta.rate) || 0) <= 0) {
        const leaf = leafNodesForMode[0];
        if (!leaf) throw new Error("Unable to find an item section for rate calculation.");
        const calculated = await calculateLeafRate(
          leaf,
          selectedSectionMeta,
          widthMm,
          heightMm,
          effectiveAreaSqft
        );
        calculatedSingleRateForSave = calculated.rate;
        calculatedSingleDetailsForSave = calculated.result;
        setMeta((prev) => ({ ...prev, rate: calculated.rate }));
        setSingleRateCalculation(calculated.result);
        setIsManualRate(false);
      }
      setRateIsStale(false);
      const leafNodes: SectionNode[] = [];
      mapLeafNodes(root, (leaf) => leafNodes.push(leaf));
      const alpha = (idx: number) => String.fromCharCode(97 + idx);
      const optionsCache = new Map<string, OptionsResponse>();
      const descriptionsCache = new Map<string, Description[]>();
      const getOptions = async (systemType: string) => {
        if (!systemType || systemType === "Blank Area") return undefined;
        if (!optionsCache.has(systemType)) {
          try { optionsCache.set(systemType, await fetchOptions(systemType)); }
          catch { optionsCache.set(systemType, { colorFinishes: [], meshTypes: [], glassSpecs: [], handleOptions: [] }); }
        }
        return optionsCache.get(systemType);
      };
      const getDescriptions = async (systemType: string, series: string) => {
        const key = `${systemType}::${series}`;
        if (!systemType || systemType === "Blank Area" || (!series && !isLouverSystem(systemType))) return [];
        if (!descriptionsCache.has(key)) {
          try { descriptionsCache.set(key, (await fetchDescriptions(systemType, isLouverSystem(systemType) ? "_" : series)).descriptions ?? []); }
          catch { descriptionsCache.set(key, []); }
        }
        return descriptionsCache.get(key) ?? [];
      };
      const buildSubItem = async (leaf: SectionNode, idx: number): Promise<QuotationSubItem> => {
        const leafMeta = getLeafSectionMeta(leaf.id);
        const systemType = leaf.systemType;
        const series = leaf.series || "";
        const description = leaf.description || getDefaultLeafDescription(systemType, meta.productType, leaf.hasExhaustFan);
        const effectiveHeightMm = getEffectiveLeafHeightRatio(root, leaf) * heightMm;
        const itemArea =
          leaf.systemType === "Blank Area" || leaf.description === "Blank Area"
            ? 0
            : mmToSqft(leaf.w * widthMm, effectiveHeightMm);
        const [descriptions, options] = await Promise.all([
          getDescriptions(systemType, series),
          getOptions(systemType),
        ]);
        const calc = calculateRateForItem({ area: itemArea, description, systemType: leaf.systemType, colorFinish: leafMeta.colorFinish, glassSpec: leaf.glass === "Yes" ? (leafMeta.glassSpec || "Yes") : "", handleType: isFixedDescription(description) ? "" : leafMeta.handleType, handleColor: isFixedDescription(description) ? "" : leafMeta.handleColor, meshPresent: leaf.mesh, meshType: leaf.mesh === "Yes" ? leafMeta.meshType : "", hasExhaustFan: Boolean(leaf.hasExhaustFan) }, descriptions, options, systemsQuery.data?.systems, louversRates);
        const resolvedRate = manualCombinationRateForSave
          ? calculatedRatesForSave[leaf.id] ?? 0
          : manualChildRates[leaf.id] ?? calculatedRatesForSave[leaf.id] ?? autoChildRates[leaf.id] ?? 0;
        const rateDetails = calculatedDetailsForSave[leaf.id] ?? childRateCalculations[leaf.id];
        const hasManualRate = manualCombinationRateForSave || Object.prototype.hasOwnProperty.call(manualChildRates, leaf.id);
        const quantity = 1;
        const frameCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.frameCutAngle);
        const shutterCutAngle = resolveCutAngleForSystem(leaf.systemType, leaf.shutterCutAngle);
        const cuttingScheduleKey = getCuttingScheduleKey(
          frameCutAngle,
          shutterCutAngle
        );
        return {
          // id: crypto.randomUUID(),
          id: leaf.id,
          refCode: meta.refCode ? `${meta.refCode}-${alpha(idx)}` : "",
          location: meta.location || "",
          width: Math.round(leaf.w * widthMm),
          height: Math.round(effectiveHeightMm),
          area: itemArea,
          systemType,
          series,
          description,
          colorFinish: meta.colorFinish,
          glassSpec: leaf.glass === "Yes" ? (leafMeta.glassSpec || "Yes") : "",
          hardwareOpeningType: leaf.systemType === "Casement" ? leafMeta.hardwareOpeningType : "",
          handleType: isFixedDescription(description) ? "" : leafMeta.handleType,
          handleColor: isFixedDescription(description) ? "" : leafMeta.handleColor,
          handleCount: calc.handleCount,
          meshPresent: leaf.mesh === "Yes",
          meshType: leaf.mesh === "Yes" ? leafMeta.meshType : "",
          rate: roundToTwo(resolvedRate),
          quantity,
          amount: roundToTwo(quantity * roundToTwo(resolvedRate) * itemArea),
          sash: leaf.sash,
          panelSashes: leaf.panelSashes,
          refImage: "",
          remarks: meta.remarks || "",
          frameCutAngle,
          shutterCutAngle,
          cuttingScheduleKey,
          hasExhaustFan: Boolean(leaf.hasExhaustFan),
          exhaustFanX: leaf.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X,
          exhaustFanY: leaf.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y,
          exhaustFanSize: leaf.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE,
          archType: "none",
          archHeightRatio: undefined,
          baseRate: calc.baseRate,
          areaSlabIndex: calc.areaSlabIndex,
          rateSource: hasManualRate ? "manual" : rateDetails ? "calculated" : "legacy",
          calculatedBaseRate: rateDetails?.baseRate,
          calculatedFinalRate: rateDetails ? roundToTwo(resolvedRate) : undefined,
          nalcoPriceUsed: rateDetails?.nalcoPrice,
          nalcoRatePerKg: rateDetails?.nalcoRatePerKg,
          profileWeightKg: rateDetails?.totalWeightKg,
          profileMaterialValue: rateDetails?.materialValue,
          rateCalculatedAt: rateDetails?.calculatedAt,
          rateCalculationVersion: rateDetails?.calculationVersion,
        };
      };
      const subItems = await Promise.all(leafNodes.map((leaf, idx) => buildSubItem(leaf, idx)));
      const isCombination = subItems.length > 1;
      const anyMesh = subItems.some((item) => item.meshPresent === true);
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
        const calc = calculateRateForItem({ area: effectiveAreaSqft, description, systemType: meta.systemType, colorFinish: meta.colorFinish, glassSpec: singleLeaf.glass === "Yes" ? (meta.glassSpec || "Yes") : "", handleType: meta.handleType, handleColor: meta.handleColor, meshPresent: singleLeaf.mesh, meshType: singleLeaf.mesh === "Yes" ? meta.meshType : "", hasExhaustFan: Boolean(singleLeaf.hasExhaustFan) }, descriptions, options, systemsQuery.data?.systems, louversRates);
        baseRate = calculatedSingleDetailsForSave?.baseRate ?? singleRateCalculation?.baseRate ?? 0;
        areaSlabIndex = calc.areaSlabIndex;
        handleCount = calc.handleCount;
        rate = calculatedSingleRateForSave ?? meta.rate;
        amount = roundToTwo(Math.max(1, meta.quantity || 1) * rate * effectiveAreaSqft);
      } else {
        const parentQuantity = Math.max(1, meta.quantity || 1);
        rate = calculatedParentRateForSave ?? meta.rate;
        amount = roundToTwo(effectiveAreaSqft * rate * parentQuantity);
      }
      const nextItem: QuotationItem = {
        id: persistedItem?.id ?? persistedItem?._id ?? crypto.randomUUID(),
        refCode: trimmedRefCode,
        location: meta.location || "",
        projectLocation: meta.location || "",
        width: widthMm,
        height: heightMm,
        area: effectiveAreaSqft,
        productType: meta.productType,
        material: persistedItem?.material ?? "",
        designType: persistedItem?.designType ?? "",
        openingType: persistedItem?.openingType ?? "",
        glassType: persistedItem?.glassType ?? "",
        accessories: persistedItem?.accessories ?? [],
        specialNotes: meta.remarks || "",
        configuratorStep: "complete",
        systemType: isCombination ? COMBINATION_SYSTEM : singleLeaf?.systemType || baseSystemType,
        series: isCombination ? "" : singleLeaf?.series || "",
        description: isCombination ? "" : singleLeaf?.description || getDefaultLeafDescription(singleLeaf?.systemType || baseSystemType, meta.productType, singleLeaf?.hasExhaustFan),
        colorFinish: meta.colorFinish,
        glassSpec: isCombination ? "" : singleLeaf?.glass === "Yes" ? (meta.glassSpec || "Yes") : "",
        hardwareOpeningType: isCombination ? "" : singleLeaf?.systemType === "Casement" ? meta.hardwareOpeningType : "",
        handleType: isCombination || isFixedDescription(singleLeaf?.description) ? "" : meta.handleType,
        handleColor: isCombination || isFixedDescription(singleLeaf?.description) ? "" : meta.handleColor,
        handleCount,
        meshPresent: isCombination ? undefined : singleLeaf?.mesh === "Yes",
        meshType: isCombination ? "" : anyMesh ? meta.meshType : "",
        rate,
        quantity: Math.max(1, meta.quantity || 1),
        amount,
        sash: isCombination ? undefined : singleLeaf?.sash,
        panelSashes: isCombination ? undefined : singleLeaf?.panelSashes,
        refImage: "",
        remarks: meta.remarks || "",
        // frameCutAngle,
        // shutterCutAngle,
        // cuttingScheduleKey,
        frameCutAngle: itemFrameCutAngle,
        shutterCutAngle: itemShutterCutAngle,
        cuttingScheduleKey: itemCuttingScheduleKey,
        hasExhaustFan: isCombination ? false : Boolean(singleLeaf?.hasExhaustFan),
        exhaustFanX: isCombination ? undefined : singleLeaf?.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X,
        exhaustFanY: isCombination ? undefined : singleLeaf?.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y,
        exhaustFanSize: isCombination ? undefined : singleLeaf?.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE,
        archType: leafNodes.every((leaf) => leaf.systemType === "Casement") ? normalizeArchType(root.archType) : "none",
        archHeightRatio: leafNodes.every((leaf) => leaf.systemType === "Casement") ? normalizeArchHeightRatio(root.archHeightRatio) : undefined,
        baseRate,
        areaSlabIndex,
        rateSource: isManualRate ? "manual" : (calculatedSingleDetailsForSave ?? singleRateCalculation) ? "calculated" : "legacy",
        calculatedBaseRate: (calculatedSingleDetailsForSave ?? singleRateCalculation)?.baseRate,
        calculatedFinalRate: (calculatedSingleDetailsForSave ?? singleRateCalculation) ? rate : undefined,
        nalcoPriceUsed: (calculatedSingleDetailsForSave ?? singleRateCalculation)?.nalcoPrice,
        nalcoRatePerKg: (calculatedSingleDetailsForSave ?? singleRateCalculation)?.nalcoRatePerKg,
        profileWeightKg: (calculatedSingleDetailsForSave ?? singleRateCalculation)?.totalWeightKg,
        profileMaterialValue: (calculatedSingleDetailsForSave ?? singleRateCalculation)?.materialValue,
        rateCalculatedAt: (calculatedSingleDetailsForSave ?? singleRateCalculation)?.calculatedAt,
        rateCalculationVersion: (calculatedSingleDetailsForSave ?? singleRateCalculation)?.calculationVersion,
        subItems: isCombination ? subItems : [],
        // configuratorLayout: cloneTree(root) as unknown as Record<string, unknown>,
        configuratorLayout: (() => {
          const layout = cloneTree(root) as SectionNode & { frameColor: string };
          layout.frameColor = selectedFrameColor;
          layout.dividerTypes = dividerBadgesRef.current.reduce<Record<string, "C" | "M">>((acc, badge) => {
            acc[badge.id] = resolveDividerValue(
              root,
              badge.leftId,
              badge.rightId,
              badgeValues[badge.id]
            );
            return acc;
          }, {});
          return layout as unknown as Record<string, unknown>;
        })(),
        //         joins: dividerBadgesRef.current.map((badge) => ({
        //   p1: badge.leftId,
        //   p2: badge.rightId,
        //   type:
        //     getResolvedSystemType(root, badge.leftId) === "Casement" &&
        //     getResolvedSystemType(root, badge.rightId) === "Casement"
        //       ? "Mullion"
        //       : getResolvedSystemType(root, badge.leftId) === "Sliding" &&
        //         getResolvedSystemType(root, badge.rightId) === "Sliding"
        //       ? "Coupler"
        //       : badgeValues[badge.id] === "M"
        //       ? "Mullion"
        //       : "Coupler",
        // })),
        joins: dividerBadgesRef.current.map((badge) => ({
          p1: badge.leftId,
          p2: badge.rightId,
          type: resolveDividerValue(root, badge.leftId, badge.rightId, badgeValues[badge.id]) === "M"
            ? "Mullion"
            : "Coupler",
        })),

        laborRate: persistedItem?.laborRate ?? 0,
        transportRate: persistedItem?.transportRate ?? 0,
        discountPercent: persistedItem?.discountPercent ?? 0,
        previewPanels: persistedItem?.previewPanels ?? 1,
      };
      console.log(
        "LEAF IDS",
        leafNodes.map((l) => ({
          leafId: l.id,
          system: l.systemType,
        }))
      );

      console.log(
        "SUBITEM IDS",
        subItems.map((s) => ({
          subItemId: s.id,
          refCode: s.refCode,
        }))
      );

      console.log(
        "DIVIDER BADGES",
        dividerBadgesRef.current
      );
      console.log("JOINS:", nextItem.joins);
      console.log("ITEM:", nextItem);
      console.log("SUBITEMS:", nextItem.subItems);

      nextItem.refImage = generateWindowDoorPreview(nextItem);
      await onSaveItem(nextItem);
      onClose();
    } catch (error) {
      console.error("Failed to save quotation item", error);
      const message = error && typeof error === "object" && "response" in error
        ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to calculate or save the quotation item.")
        : error instanceof Error ? error.message : "Failed to calculate or save the quotation item.";
      setRateCalculationError(message);
      alert(message);
    } finally {
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

  const activeColorFinishName = selectedSectionMeta.colorFinish || meta.colorFinish;
  const activeColorOption = (combinationOptionsQuery.data?.colorFinishes ?? metaOptionsQuery.data?.colorFinishes ?? [])
    .find((option) => option.name === activeColorFinishName);
  const savedFrameColor = persistedItem?.colorFinish === activeColorFinishName
    ? persistedItem.configuratorLayout?.frameColor
    : undefined;
  const selectedFrameColor = resolveFrameColor(
    activeColorFinishName,
    activeColorOption?.color || (typeof savedFrameColor === "string" ? savedFrameColor : undefined)
  );

  const renderCanvas = useCallback(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;
    dividerBadgesRef.current = renderWindowDoorDesign({
      layer, stageSize, view, root, widthMm, heightMm, meta, baseSystemType,
      selectedFrameColor, hideSelectionForExport, selectedId, selectedSlidingPanelIndex,
      badgeValues, setSelectedId, setSelectedSlidingPanelIndex, setSelectedDivider,
      onPanStart: (event) => {
        event.cancelBubble = true;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        isPanningRef.current = true;
        panStartRef.current = pointer;
        panOriginRef.current = panOffset;
        setSelectedId(null);
        setSelectedSlidingPanelIndex(null);
        setSelectedDivider(null);
        stage.container().style.cursor = "grabbing";
      },
      onPanEnter: () => { if (!isPanningRef.current) stage.container().style.cursor = "grab"; },
      onPanLeave: () => { if (!isPanningRef.current) stage.container().style.cursor = "default"; },
    });
  }, [heightMm, hideSelectionForExport, panOffset, root, selectedFrameColor, selectedId, selectedSlidingPanelIndex, stageSize, view, widthMm, badgeValues, meta, baseSystemType]);

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
    if (!editingItem) return;
    const mapped = mapItemToConfiguratorState(editingItem);
    console.log("EDITING ITEM JOINS");
    console.dir(editingItem.joins, { depth: null });
    setWidthMm(mapped.width);
    setHeightMm(mapped.height);
    setBaseSystemType(mapped.baseSystemType);
    setBaseGlass(mapped.baseGlass);
    setBaseMesh(mapped.baseMesh);
    setMeta(mapped.meta);
    reset(mapped.root);
    console.log("ROOT DIVIDER TYPES");
    console.dir(mapped.root.dividerTypes, { depth: null });
    const mappedLeaves: SectionNode[] = [];
    mapLeafNodes(mapped.root, (leaf) => mappedLeaves.push(leaf));
    // setSelectedId(mappedLeaves.length > 1 ? mappedLeaves[0].id : "root");
    setSelectedId("root");

    setSelectedDivider(null);
    setSelectedSlidingPanelIndex(null);
    setIsManualRate(editingItem.rateSource === "manual");
    setSingleRateCalculation(
      editingItem.rateSource === "calculated" && editingItem.calculatedBaseRate !== undefined
        ? {
          clientId: editingItem.id,
          baseRate: editingItem.calculatedBaseRate,
          materialValue: editingItem.profileMaterialValue || 0,
          area: editingItem.area || 0,
          totalWeightKg: editingItem.profileWeightKg || 0,
          nalcoPrice: editingItem.nalcoPriceUsed || 0,
          nalcoRatePerKg: editingItem.nalcoRatePerKg || 0,
          calculatedAt: editingItem.rateCalculatedAt || "",
          calculationVersion: editingItem.rateCalculationVersion || 1,
          warnings: [],
        }
        : null
    );
    const leaves: SectionNode[] = [];
    mapLeafNodes(mapped.root, (leaf) => leaves.push(leaf));
    const sortedLeaves = leaves.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const subItems = editingItem.subItems ?? [];
    const nextManualRates: Record<string, number> = {};
    const nextAutoRates: Record<string, number> = {};
    const nextRateCalculations: Record<string, RateCalculationResult> = {};
    const nextChildSectionMeta: Record<string, SectionOptionMeta> = {};
    sortedLeaves.forEach((leaf, idx) => {
      const subItem = subItems.find((sub) => sub.id === leaf.id || sub._id === leaf.id) ?? subItems[idx];
      if (subItem?.rate !== undefined) {
        if (subItem.rateSource === "calculated") {
          nextAutoRates[leaf.id] = Number(subItem.rate) || 0;
          nextRateCalculations[leaf.id] = {
            clientId: leaf.id,
            baseRate: subItem.calculatedBaseRate || 0,
            materialValue: subItem.profileMaterialValue || 0,
            area: subItem.area || 0,
            totalWeightKg: subItem.profileWeightKg || 0,
            nalcoPrice: subItem.nalcoPriceUsed || 0,
            nalcoRatePerKg: subItem.nalcoRatePerKg || 0,
            calculatedAt: subItem.rateCalculatedAt || "",
            calculationVersion: subItem.rateCalculationVersion || 1,
            warnings: [],
          };
        } else {
          nextManualRates[leaf.id] = Number(subItem.rate) || 0;
        }
      }
      if (subItem) {
        nextChildSectionMeta[leaf.id] = {
          colorFinish: subItem.colorFinish || "",
          glassSpec: subItem.glassSpec || DEFAULT_GLASS_SPEC,
          hardwareOpeningType: subItem.hardwareOpeningType || "hinges",
          handleType: subItem.handleType || "",
          handleColor: subItem.handleColor || DEFAULT_HANDLE_COLOR,
          meshType: subItem.meshType || "",
        };
        leaf.exhaustFanX = typeof subItem.exhaustFanX === "number" ? subItem.exhaustFanX : leaf.exhaustFanX;
        leaf.exhaustFanY = typeof subItem.exhaustFanY === "number" ? subItem.exhaustFanY : leaf.exhaustFanY;
        leaf.exhaustFanSize = typeof subItem.exhaustFanSize === "number" ? subItem.exhaustFanSize : leaf.exhaustFanSize;
      }
    });
    setManualChildRates(nextManualRates);
    setAutoChildRates(nextAutoRates);
    setChildRateCalculations(nextRateCalculations);
    setRateIsStale(false);
    setChildSectionMeta(nextChildSectionMeta);

    setBadgeValues(mapped.root.dividerTypes ?? {});
  }, [editingItem, reset]);

  useEffect(() => {
    if (editingItem) return;
    reset(buildPreset(baseSystemType, baseGlass, baseMesh));
    setSelectedId("root");
    setManualChildRates({});
    setAutoChildRates({});
    setChildSectionMeta({});
    setIsManualRate(false);
    setSingleRateCalculation(null);
    setChildRateCalculations({});
    setRateIsStale(false);
  }, [baseGlass, baseMesh, baseSystemType, editingItem, reset]);

  useEffect(() => {
    setIsManualRate(false);
  }, [selectedNode.systemType, selectedNode.series, selectedNode.description, selectedNode.glass, selectedNode.mesh, meta.colorFinish, meta.glassSpec, meta.hardwareOpeningType, meta.handleType, meta.handleColor, meta.meshType, widthMm, heightMm, profitPercentage]);

  const archControls = canConfigureArch ? (
    <>
      <label className="text-xs text-gray-600">Arch Type<CustomSelect value={normalizeArchType(root.archType)} onChange={(e) => { const archType = e.target.value as ArchType; updateSelectedNode((target) => { target.archType = archType; target.archHeightRatio = archType === "none" ? DEFAULT_ARCH_HEIGHT_RATIO : normalizeArchHeightRatio(target.archHeightRatio); }); }} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="none">None</option><option value="circular">Circular</option><option value="triangle">Triangle</option></CustomSelect></label>
      {normalizeArchType(root.archType) !== "none" ? (
        <label className="text-xs text-gray-600">Arch Rise<input type="range" min={8} max={45} step={1} value={Math.round(normalizeArchHeightRatio(root.archHeightRatio) * 100)} onChange={(e) => { const value = Number(e.target.value) / 100; updateSelectedNode((target) => { target.archHeightRatio = normalizeArchHeightRatio(value); }); }} className="mt-2 w-full" /><div className="mt-1 text-[11px] text-gray-500">{Math.round(normalizeArchHeightRatio(root.archHeightRatio) * 100)}% of frame height</div></label>
      ) : null}
    </>
  ) : null;
  //  const dividerValue =
  //   onlyMullion
  //     ? "M"
  //     : onlyCoupler
  //     ? "C"
  //     : selectedDivider
  //       ? (badgeValues[selectedDivider.id] ?? "C")
  //       : "C";
  const dividerValue = selectedDivider
    ? resolveDividerValue(
      root,
      selectedDivider.leftId,
      selectedDivider.rightId,
      badgeValues[selectedDivider.id]
    )
    : "C";

  return (
    <div className="relative h-full w-full overflow-hidden border border-slate-300 bg-white shadow-2xl">
      <button
        type="button"
        onClick={onClose}
        disabled={isSaving}
        aria-label="Close configurator"
        className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex h-full">
        <div className="h-full flex-1 min-w-0 border-r border-slate-200 bg-white p-2">
          <div ref={canvasWrapRef} className="relative h-full min-h-[520px] w-full min-w-0">
            <div ref={containerRef} className="rounded-xl border border-gray-200 bg-[#F9FBFD] w-full overflow-hidden" style={{ width: "100%", height: stageSize.h }} />
            <div className="pointer-events-none absolute inset-0">
              {dimensionLabels.map((label) => (
                <div key={label.id} className="pointer-events-auto absolute w-[88px]" style={{ left: label.x, top: label.y }}>
                  <DimensionTextInput
                    value={label.value}
                    onChange={label.onChange}
                    onFocus={() => {
                      setSelectedId(label.selectId);
                      setSelectedSlidingPanelIndex(label.panelIndex ?? null);
                    }}
                  />
                  {typeof label.staticValue === "number" ? (
                    <div className="mt-1 rounded-sm border border-slate-200 bg-white/95 px-1 py-0.5 text-center text-[11px] font-medium text-slate-600 shadow-sm">
                      Effective {label.staticValue}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {/* <div className="pointer-events-none absolute right-4 top-4 z-10 text-xs text-gray-500">Use the dimension boxes to edit sizes</div> */}
            <div
              // className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-xs text-gray-500">
              className="pointer-events-none absolute bottom-4 left-[18%] z-10 -translate-x-1/2 text-xs text-gray-500">
              Use the dimension boxes to edit sizes
            </div>

            <div className="pointer-events-none absolute left-[20%] top-4 z-10 flex flex-col gap-2">
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white/95 p-2 shadow">
                <button type="button" onClick={undo} disabled={past.length === 0} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-50"><Undo2 className="h-4 w-4" /></button>
                <button type="button" onClick={redo} disabled={future.length === 0} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-50"><Redo2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => { reset(buildPreset(baseSystemType, baseGlass, baseMesh)); setSelectedId("root"); setSelectedDivider(null); setSelectedSlidingPanelIndex(null); }} className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50"><RotateCcw className="h-4 w-4" /></button>
                <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-700"><span>Split Count</span>

                  <CustomSelect
                    value={splitCount}
                    onChange={(e) => setSplitCount(Number(e.target.value) || 2)}
                    className="w-[70px]"
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </CustomSelect>
                </label>
                <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-gray-700"><span>Direction</span>

                  <CustomSelect
                    value={splitDirection}
                    onChange={(e) => setSplitDirection(e.target.value as SplitDirection)}
                    className="w-[130px]"
                  >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </CustomSelect>
                </label>
                <button type="button"
                  // onClick={() => splitSelected(splitDirection)}
                  onClick={() => {
                    if (!meta.refCode.trim()) {
                      alert("Please fill the Ref Code.");
                      return;
                    }

                    splitSelected(splitDirection);
                  }}

                  disabled={selectedNode.systemType === "Sliding"} className="flex items-center gap-2 rounded-lg border border-gray-200  bg-[#0f172A] px-3 py-2 text-sm text-white hover:bg-[#0f172A] disabled:cursor-not-allowed disabled:opacity-50">{splitDirection === "vertical" ? <SplitSquareVertical className="h-4 w-4" /> : <SplitSquareHorizontal className="h-4 w-4" />}Split</button>
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

                {selectedDivider && (
                  <label className="text-xs text-gray-600">
                    Divider Type

                    <CustomSelect
                      value={dividerValue}
                      onChange={(e) => {
                        const value = e.target.value as "C" | "M";

                        setBadgeValues((prev) => ({
                          ...prev,
                          [selectedDivider.id]: value,
                        }));
                      }}
                      className="mt-1 w-full focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                    >
                      <option value="C">Coupler</option>
                      <option value="M">Mullion</option>
                    </CustomSelect>

                  </label>
                )}
                {!selectedDivider && (
                  isCombinationParentSelection ? (
                    <>
                      <label {...requiredFieldProps("refCode")} className="text-xs text-gray-600">Ref Code<input value={meta.refCode} onChange={(e) => setMeta((prev) => ({ ...prev, refCode: e.target.value }))} required className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                      <label className="text-xs text-gray-600">Location<input value={meta.location} placeholder="Living Room" onChange={(e) => setMeta((prev) => ({ ...prev, location: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                      <label className="text-xs text-gray-600">System<input value={COMBINATION_SYSTEM} readOnly className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                      {archControls}
                      <label className="text-xs text-gray-600">Quantity<input type="number" min={1} value={meta.quantity} onChange={(e) => setMeta((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value) || 1) }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>

                      <label className="text-xs text-gray-600">Colour Finish
                        <CustomSelect value={meta.colorFinish} onChange={(e) => setMeta((prev) => ({ ...prev, colorFinish: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{combinationOptionsQuery.data?.colorFinishes.map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</CustomSelect>
                      </label>
                      {editingItem && (
                        <>
                          <RateCalculationAction
                            isCalculating={isCalculatingRate}
                            error={rateCalculationError}
                            isStale={rateIsStale}
                            result={singleRateCalculation}
                            onCalculate={handleCalculateRate}
                          />
                          <label className="text-xs text-gray-600">Rate<input type="number" min={0} value={meta.rate} onChange={(e) => { setIsManualRate(true); setMeta((prev) => ({ ...prev, rate: Number(e.target.value) || 0 })); }} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                        </>
                      )}
                      <label className="text-xs text-gray-600">Remarks<textarea value={meta.remarks} onChange={(e) => setMeta((prev) => ({ ...prev, remarks: e.target.value }))} rows={2} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                    </>
                  ) : (
                    <>
                      {isCombinationChildSelection ? (
                        <label className="text-xs text-gray-600">Ref Code (Auto)<input value={childAutoRef || "Will be generated from parent ref"} readOnly className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                      ) : (
                        <>
                          <label {...requiredFieldProps("refCode")} className="text-xs text-gray-600">Ref Code<input value={meta.refCode} onChange={(e) => setMeta((prev) => ({ ...prev, refCode: e.target.value }))} required className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                          <label className="text-xs text-gray-600">Location<input value={meta.location} placeholder="Living Room" onChange={(e) => setMeta((prev) => ({ ...prev, location: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                        </>
                      )}
                      {isSlidingPanelSelection ? (
                        <label className="text-xs text-gray-600">Sliding Movement<CustomSelect value={selectedNode.panelSashes && selectedNode.panelSashes.length === (selectedNode.panelFractions?.length ?? 0) && selectedSlidingPanelIndex !== null ? (selectedNode.panelSashes[selectedSlidingPanelIndex] ?? "fixed") : "fixed"} onChange={(e) => { const sash = e.target.value as SashType; if (selectedSlidingPanelIndex === null) return; updateSelectedNode((target) => { const panelCount = target.panelFractions?.length ?? 0; if (panelCount < 2) return; const nextSashes = target.panelSashes && target.panelSashes.length === panelCount ? [...target.panelSashes] : buildDefaultSlidingPanelSashes(panelCount); nextSashes[selectedSlidingPanelIndex] = sash; target.panelSashes = nextSashes; }); }} className="mt-1 w-full  focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="left">Left Sliding</option><option value="right">Right Sliding</option><option value="double">Both Ways</option><option value="fixed">Fixed</option></CustomSelect></label>
                      ) : (
                        <>

                          <label className="text-xs text-gray-600">
                            Section System
                            <CustomSelect
                              value={selectedNode.systemType}
                              onChange={(e) => {
                                const nextSystem = e.target.value as SystemType;
                                updateSelectedLeaves((target) => {
                                  target.systemType = nextSystem;
                                  target.frameCutAngle = defaultCutAngleForSystem(nextSystem);
                                  target.shutterCutAngle = defaultCutAngleForSystem(nextSystem);
                                  if (nextSystem === "Louvers") {
                                    target.description = "Louvers";
                                  }
                                  else if (nextSystem === "Blank Area") {
                                    target.description = "Blank Area";
                                  }
                                  else {
                                    target.description = "";
                                  }

                                  target.series = "";
                                  target.hasExhaustFan = false;

                                  target.panelSashes = undefined;
                                  target.panelFractions = undefined;
                                  target.panelMeshCount = undefined;
                                  target.archType =
                                    nextSystem === "Casement"
                                      ? normalizeArchType(target.archType)
                                      : "none";

                                  target.archHeightRatio = DEFAULT_ARCH_HEIGHT_RATIO;

                                  target.mesh =
                                    isLouverSystem(nextSystem)
                                      ? "No"
                                      : target.mesh;

                                  target.glass =
                                    isLouverSystem(nextSystem)
                                      ? "No"
                                      : target.glass;

                                  target.exhaustFanX = DEFAULT_EXHAUST_FAN_X;
                                  target.exhaustFanY = DEFAULT_EXHAUST_FAN_Y;
                                  target.exhaustFanSize = DEFAULT_EXHAUST_FAN_SIZE;

                                  if (
                                    nextSystem !== "Sliding" &&
                                    (target.sash === "left" ||
                                      target.sash === "right" ||
                                      target.sash === "double")
                                  ) {
                                    target.sash = "fixed";
                                  }
                                });
                              }}
                              className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                            >
                              {[
                                ...(systems?.systems || []).filter((sys) => sys !== "Exhaust Fan"),
                                ...(isCombinationChildSelection ? ["Blank Area"] : []),

                              ].map((sys) => (
                                <option key={sys} value={sys}>
                                  {sys}
                                </option>
                              ))}
                            </CustomSelect>
                          </label>
                          {selectedSystemSupportsCatalog && (
                            <>
                              <label {...requiredFieldProps("series")} className="text-xs text-gray-600">Section Series<CustomSelect value={selectedNode.series} onChange={(e) => { const nextSeries = e.target.value; updateSelectedLeaves((target) => { target.series = nextSeries; target.description = ""; target.hasExhaustFan = false; target.panelFractions = undefined; target.panelMeshCount = undefined; target.panelSashes = undefined; }); }} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{seriesOptions.map((series) => <option key={series} value={series}>{series}</option>)}</CustomSelect></label>
                              <label {...requiredFieldProps("description")} className="text-xs text-gray-600">Section Description<CustomSelect value={selectedNode.description} onChange={(e) => { const nextDescription = e.target.value; updateSelectedSectionMeta({ meshType: "", ...(isFixedDescription(nextDescription) ? { handleType: "", handleColor: "" } : {}) }); if (selectedNode.systemType === "Sliding") { updateSelectedNode((target) => { target.description = nextDescription; target.hasExhaustFan = false; target.split = "none"; target.children = undefined; const pattern = parsePanelPattern(nextDescription); if (pattern) { target.panelFractions = pattern.fractions; target.panelMeshCount = pattern.meshCount; target.mesh = (pattern.meshCount ?? 0) > 0 ? "Yes" : "No"; target.panelSashes = target.panelSashes && target.panelSashes.length === pattern.fractions.length ? target.panelSashes : buildDefaultSlidingPanelSashes(pattern.fractions.length); } else { target.panelFractions = undefined; target.panelMeshCount = undefined; target.mesh = "No"; target.panelSashes = undefined; } }); return; } updateSelectedLeaves((target) => { target.description = nextDescription; target.hasExhaustFan = false; const pattern = parsePanelPattern(nextDescription); if (pattern) { target.panelFractions = pattern.fractions; target.panelMeshCount = pattern.meshCount; target.panelSashes = undefined; } else { target.panelFractions = undefined; target.panelMeshCount = undefined; target.panelSashes = undefined; } }); }} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{descriptionOptions.map((desc: Description) => <option key={desc.name} value={desc.name}>{desc.name}</option>)}</CustomSelect></label>

                              <div className="flex items-start">
  {/* Section Glass */}
  <div className="flex-1 text-xs text-gray-600">
    <span>Section Glass</span>

    <div className="mt-2 flex items-center gap-5">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name="section-glass"
          value="Yes"
          checked={selectedNode.glass === "Yes"}
          onChange={() => {
            updateSelectedLeaves((target) => {
              target.glass = "Yes";
            });
          }}
          className="h-4 w-4 accent-[#ef0b0b]"
        />
        Yes
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name="section-glass"
          value="No"
          checked={selectedNode.glass === "No"}
          onChange={() => {
            updateSelectedLeaves((target) => {
              target.glass = "No";
            });
          }}
          className="h-4 w-4 accent-[#ef0b0b]"
        />
        No
      </label>
    </div>
  </div>

  {/* Vertical Separator */}
  <div className="mx-5 h-12 w-px bg-slate-300" />

  {/* Section Mesh */}
  <div className="relative -left-1 flex-1 text-xs text-gray-600">
    <span>Section Mesh</span>

    <div className="mt-2 flex items-center gap-5">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name="section-mesh"
          value="Yes"
          checked={selectedNode.mesh === "Yes"}
          disabled={selectedNode.systemType === "Sliding"}
          onChange={() => {
            if (selectedNode.systemType === "Sliding") return;

            updateSelectedLeaves((target) => {
              target.mesh = "Yes";
            });
          }}
          className="h-4 w-4 accent-[#ef0b0b]"
        />
        Yes
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name="section-mesh"
          value="No"
          checked={selectedNode.mesh === "No"}
          disabled={selectedNode.systemType === "Sliding"}
          onChange={() => {
            if (selectedNode.systemType === "Sliding") return;

            updateSelectedLeaves((target) => {
              target.mesh = "No";
            });
          }}
          className="h-4 w-4 accent-[#ef0b0b]"
        />
        No
      </label>
    </div>
  </div>
</div>

                              {archControls}
                            </>
                          )}

                          {canInsertExhaustFan && (
                            <div className="text-xs text-gray-600">
                              <span>Exhaust Fan Insert</span>

                              <div className="mt-2 flex items-center gap-5">
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="radio"
                                    name="exhaust-fan"
                                    value="Yes"
                                    checked={selectedNode.hasExhaustFan}
                                    onChange={() => {
                                      updateSelectedLeaves((target) => {
                                        target.hasExhaustFan = true;
                                        target.glass = "Yes";
                                        target.mesh = "No";
                                        target.exhaustFanX = DEFAULT_EXHAUST_FAN_X;
                                        target.exhaustFanY = DEFAULT_EXHAUST_FAN_Y;
                                        target.exhaustFanSize = DEFAULT_EXHAUST_FAN_SIZE;
                                      });
                                    }}
                                    className="h-4 w-4 accent-[#ef0b0b]"
                                  />
                                  Yes
                                </label>

                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="radio"
                                    name="exhaust-fan"
                                    value="No"
                                    checked={!selectedNode.hasExhaustFan}
                                    onChange={() => {
                                      updateSelectedLeaves((target) => {
                                        target.hasExhaustFan = false;
                                      });
                                    }}
                                    className="h-4 w-4 accent-[#ef0b0b]"
                                  />
                                  No
                                </label>
                              </div>

                              <div className="mt-1 text-[11px] text-gray-500">
                                Fixed glass section will include the exhaust fan cut-out.
                              </div>
                            </div>
                          )}
                          {hasAdjustableExhaustFan && (
                            <>
                              <label className="text-xs text-gray-600">Fan Horizontal Position<input type="range" min={18} max={82} step={1} value={Math.round((selectedNode.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X) * 100)} onChange={(e) => { const value = Number(e.target.value) / 100; updateSelectedNode((target) => { target.exhaustFanX = clampValue(value, 0.18, 0.82); }); }} className="mt-2 w-full" /><div className="mt-1 text-[11px] text-gray-500">{Math.round((selectedNode.exhaustFanX ?? DEFAULT_EXHAUST_FAN_X) * 100)}%</div></label>
                              <label className="text-xs text-gray-600">Fan Vertical Position<input type="range" min={18} max={82} step={1} value={Math.round((selectedNode.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y) * 100)} onChange={(e) => { const value = Number(e.target.value) / 100; updateSelectedNode((target) => { target.exhaustFanY = clampValue(value, 0.18, 0.82); }); }} className="mt-2 w-full" /><div className="mt-1 text-[11px] text-gray-500">{Math.round((selectedNode.exhaustFanY ?? DEFAULT_EXHAUST_FAN_Y) * 100)}%</div></label>
                              <label className="text-xs text-gray-600">Fan Size<input type="range" min={20} max={90} step={1} value={Math.round((selectedNode.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE) * 100)} onChange={(e) => { const value = Number(e.target.value) / 100; updateSelectedNode((target) => { target.exhaustFanSize = clampValue(value, 0.2, 0.9); }); }} className="mt-2 w-full" /><div className="mt-1 text-[11px] text-gray-500">{Math.round((selectedNode.exhaustFanSize ?? DEFAULT_EXHAUST_FAN_SIZE) * 100)}%</div></label>
                            </>
                          )}
                          {selectedSystemSupportsCatalog && (
                            <>
                              {!isCombinationChildSelection && <label className="text-xs text-gray-600">Color Finish<CustomSelect value={selectedSectionMeta.colorFinish} onChange={(e) => updateSelectedSectionMeta({ colorFinish: e.target.value })} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{metaOptionsQuery.data?.colorFinishes.map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</CustomSelect></label>}
                              <label className="text-xs text-gray-600">Glass Spec<CustomSelect value={selectedSectionMeta.glassSpec} onChange={(e) => updateSelectedSectionMeta({ glassSpec: e.target.value })} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{metaOptionsQuery.data?.glassSpecs.map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</CustomSelect></label>

                              {selectedNode.systemType === "Casement" &&
  selectedNode.description !== "Fix" && (
    <div className="text-xs text-gray-600">
      <span>Shutter Hardware</span>

      <div className="mt-2 flex items-center gap-5">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="shutter-hardware"
            value="hinges"
            checked={
              selectedSectionMeta.hardwareOpeningType === "hinges"
            }
            onChange={() =>
              updateSelectedSectionMeta({
                hardwareOpeningType: "hinges",
              })
            }
            className="h-4 w-4 accent-[#ef0b0b]"
          />
          Hinges
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="shutter-hardware"
            value="frictionStay"
            checked={
              selectedSectionMeta.hardwareOpeningType === "frictionStay"
            }
            onChange={() =>
              updateSelectedSectionMeta({
                hardwareOpeningType: "frictionStay",
              })
            }
            className="h-4 w-4 accent-[#ef0b0b]"
          />
          Friction Stay
        </label>
      </div>
    </div>
  )}

                              <label className="text-xs text-gray-600">Handle Type<CustomSelect disabled={isFixedDescription(selectedNode.description)} value={isFixedDescription(selectedNode.description) ? "" : selectedSectionMeta.handleType} onChange={(e) => updateSelectedSectionMeta({ handleType: e.target.value, handleColor: DEFAULT_HANDLE_COLOR })} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{metaOptionsQuery.data?.handleOptions.map((opt: HandleOption) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</CustomSelect></label>
                              <label className="text-xs text-gray-600">Handle Color<CustomSelect disabled={isFixedDescription(selectedNode.description)} value={isFixedDescription(selectedNode.description) ? "" : selectedSectionMeta.handleColor} onChange={(e) => updateSelectedSectionMeta({ handleColor: e.target.value })} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"><option value="">Select</option>{(metaHandleOption?.colors ?? []).map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</CustomSelect></label>
                            </>
                          )}
                          {selectedSystemSupportsCatalog && (!isCombinationChildSelection || selectedNode.systemType === "Sliding") && <label className="text-xs text-gray-600">Mesh Type<CustomSelect value={selectedSectionMeta.meshType} onChange={(e) => updateSelectedSectionMeta({ meshType: e.target.value })} className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" disabled={selectedNode.mesh !== "Yes"}><option value="">Select</option>{metaOptionsQuery.data?.meshTypes.map((opt: OptionWithRate) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}</CustomSelect></label>}
                          {isCombinationChildSelection ? (
                            <>
                              {selectedNode.systemType !== "Blank Area" && (
                                <>
                                  <label className="text-xs text-gray-600">
                                    Frame Cut Angle

                                    {selectedNodeIsPureCasement ? (
                                      <input
                                        type="text"
                                        value="45°"
                                        disabled
                                        className="mt-1 w-full rounded-md border border-gray-400 bg-gray-100 px-2 py-2 text-sm cursor-not-allowed"
                                      />
                                    ) : (
                                      <CustomSelect
                                        value={selectedNode.frameCutAngle}
                                        onChange={(e) => {
                                          const value = e.target.value as CutAngle;

                                          const next = cloneTree(root);
                                          const target = findNode(next, selectedNode.id);

                                          if (!target) return;

                                          target.frameCutAngle = value;
                                          push(next);
                                        }}
                                        className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                                      >
                                        <option value="45">45°</option>
                                        <option value="90">90°</option>
                                      </CustomSelect>
                                    )}
                                  </label>

                                  <label className="text-xs text-gray-600">
                                    Shutter Cut Angle

                                    {selectedNodeIsPureCasement ? (
                                      <input
                                        type="text"
                                        value="45°"
                                        disabled
                                        className="mt-1 w-full rounded-md border border-gray-400 bg-gray-100 px-2 py-2 text-sm cursor-not-allowed"
                                      />
                                    ) : (
                                      <CustomSelect
                                        value={selectedNode.shutterCutAngle}
                                        onChange={(e) => {
                                          const value = e.target.value as CutAngle;

                                          const next = cloneTree(root);
                                          const target = findNode(next, selectedNode.id);

                                          if (!target) return;

                                          target.shutterCutAngle = value;
                                          push(next);
                                        }}
                                        className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                                      >
                                        <option value="45">45°</option>
                                        <option value="90">90°</option>
                                      </CustomSelect>
                                    )}
                                  </label>
                                </>
                              )}
                              {selectedNode.systemType !== "Blank Area" &&
                                <div className="text-[11px] text-gray-500">Rate is calculated and edited at the combination parent level.</div>}
                              <div className="mt-1 text-[11px] text-gray-500">Section area: {selectedLeafAreaSqft.toFixed(2)} sqft</div>
                            </>

                          ) : (
                            <>
                              <label className="text-xs text-gray-600">Quantity<input type="number" min={1} value={meta.quantity} onChange={(e) => setMeta((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value) || 1) }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>

                              <label className="text-xs text-gray-600">
                                Frame Cut Angle
                                {selectedNodeIsPureCasement ? (
                                  <input
                                    type="text"
                                    value="45°"
                                    disabled
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                                  />
                                ) : (

                                  <CustomSelect
                                    value={selectedNode.frameCutAngle}
                                    onChange={(e) => {
                                      const value = e.target.value as CutAngle;

                                      const next = cloneTree(root);
                                      const target = findNode(next, selectedNode.id);

                                      if (!target) return;

                                      target.frameCutAngle = value;
                                      push(next);
                                    }}
                                    className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                                  >
                                    <option value="45">45°</option>
                                    <option value="90">90°</option>
                                  </CustomSelect>
                                )}
                              </label>

                              <label className="text-xs text-gray-600">
                                Shutter Cut Angle
                                {selectedNodeIsPureCasement ? (
                                  <input
                                    type="text"
                                    value="45°"
                                    disabled
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                                  />
                                ) : (

                                  <CustomSelect
                                    value={selectedNode.shutterCutAngle}
                                    onChange={(e) => {
                                      const value = e.target.value as CutAngle;

                                      const next = cloneTree(root);
                                      const target = findNode(next, selectedNode.id);

                                      if (!target) return;

                                      target.shutterCutAngle = value;
                                      push(next);
                                    }}
                                    className="mt-1 w-full focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                                  >
                                    <option value="45">45°</option>
                                    <option value="90">90°</option>
                                  </CustomSelect>
                                )}
                              </label>

                              {editingItem && selectedNode.systemType !== "Blank Area" && (

                                <>
                                  <RateCalculationAction
                                    isCalculating={isCalculatingRate}
                                    error={rateCalculationError}
                                    isStale={rateIsStale}
                                    result={singleRateCalculation}
                                    onCalculate={handleCalculateRate}
                                  />
                                  <label className="text-xs text-gray-600">Rate<input type="number" min={0} value={meta.rate} onChange={(e) => { setIsManualRate(true); setMeta((prev) => ({ ...prev, rate: Number(e.target.value) || 0 })); }} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                                </>)}
                              <label className="text-xs text-gray-600">Remarks<textarea value={meta.remarks} onChange={(e) => setMeta((prev) => ({ ...prev, remarks: e.target.value }))} rows={2} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]" /></label>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )
                )}

              </div>

            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"><span className="text-gray-500">Width</span><span className="font-semibold">{widthMm} mm</span></div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"><span className="text-gray-500">Height</span><span className="font-semibold">{heightMm} mm</span></div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"><span className="text-gray-500">Area</span><span className="font-semibold">{effectiveAreaSqft} sq ft</span></div>
              <div className="pt-2">
                {validationStillMissing && <p role="alert" className="text-xs text-red-600">{validationTarget?.field === "refCode" ? "Ref Code" : validationTarget?.field === "series" ? "Section Series" : "Section Description"} is required. Complete the highlighted field before saving.</p>}
                <button type="button" onClick={handleSaveItem} aria-disabled={Boolean(missingRequiredField)} title={missingRequiredField ? "Complete required details before saving" : undefined} disabled={isSaving || isRetryingLookups || (!saveLookupsReady && !saveLookupsFailed)} className="w-full rounded-lg bg-[#0f172A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f172A] disabled:opacity-60 aria-disabled:opacity-60">{isSaving ? "Saving..." : isRetryingLookups ? "Retrying..." : saveLookupsFailed ? "Retry loading options" : !saveLookupsReady ? "Loading options..." : editingItem ? "Update Item" : "Add to Quotation"}</button>
                {lookupLoadError ? <p role="alert" className="mt-2 text-xs font-medium text-red-600">{lookupLoadError}</p> : null}
                <button type="button" onClick={onClose} className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
              <div className="text-xs text-gray-400">Selected: <span className="font-medium text-gray-600">{selectedId === null ? "None" : selectedNode.id === "root" ? "Whole Frame" : isSlidingPanelSelection ? `Sliding Panel ${selectedSlidingPanelIndex! + 1}` : "Section"}</span></div>
            </div>
          </div>
        )}
        {!showSummaryPopup && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-30">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
              <div>
                {validationStillMissing && <p role="alert" className="text-xs text-red-600">{validationTarget?.field === "refCode" ? "Ref Code" : validationTarget?.field === "series" ? "Section Series" : "Section Description"} is required. Complete the highlighted field before saving.</p>}
                <button type="button" onClick={handleSaveItem} aria-disabled={Boolean(missingRequiredField)} title={missingRequiredField ? "Complete required details before saving" : undefined} disabled={isSaving || isRetryingLookups || (!saveLookupsReady && !saveLookupsFailed)} className="rounded-lg bg-[#124657] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3642] disabled:opacity-60 aria-disabled:opacity-60">{isSaving ? "Saving..." : isRetryingLookups ? "Retrying..." : saveLookupsFailed ? "Retry loading options" : !saveLookupsReady ? "Loading options..." : editingItem ? "Update Item" : "Add to Quotation"}</button>
                {lookupLoadError ? <p role="alert" className="mt-1 max-w-[260px] text-xs font-medium text-red-600">{lookupLoadError}</p> : null}
              </div>
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
