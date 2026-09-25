import Konva from "konva/lib/index";
import type { KonvaEventObject } from "konva/lib/Node";
import type { QuotationItem } from "@/types/quotation";

export type KonvaGroup = InstanceType<typeof Konva.Group>;

export type KonvaLayer = InstanceType<typeof Konva.Layer>;

export type PathContext = {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
  closePath: () => void;
};

export type SplitDirection = "none" | "vertical" | "horizontal";

export type SystemType = "Casement" | "Sliding" | "Slide N Fold" | "Louvers" | "Blank Area";

export type SashType = "fixed" | "left" | "right" | "double" | "top" | "bottom";

export type YesNo = "Yes" | "No";

export type CutAngle = "45" | "90";

export type ArchType = "none" | "circular" | "triangle";

export type SectionNode = {
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
  archType?: ArchType;
  archHeightRatio?: number;
  glass: YesNo;
  mesh: YesNo;
  frameCutAngle: CutAngle;
  shutterCutAngle: CutAngle;
  children?: SectionNode[];
  dividerTypes?: Record<string, "C" | "M">;
};

export type ProductMeta = {
  productType: "Window" | "Door";
  systemType: string;
  series: string;
  description: string;
  colorFinish: string;
  glassSpec: string;
  hardwareOpeningType: "hinges" | "frictionStay" | "";
  handleType: string;
  handleColor: string;
  meshPresent: string;
  meshType: string;
  location: string;
  quantity: number;
  refCode: string;
  remarks: string;
  rate: number;
  frameCutAngle: CutAngle;
  shutterCutAngle: CutAngle;
};

export const DEFAULT_GLASS_SPEC = "6mm Clear Toughened";

export const DEFAULT_HANDLE_COLOR = "Black";

export const normalizeCutAngle = (value: unknown, fallback: CutAngle = "90"): CutAngle =>
  value === "45" || value === 45 ? "45" : value === "90" || value === 90 ? "90" : fallback;

export const defaultCutAngleForSystem = (systemType: string): CutAngle =>
  systemType === "Casement" ? "45" : "90";

export const resolveCutAngleForSystem = (systemType: string, value: unknown): CutAngle =>
  systemType === "Casement"
    ? "45"
    : normalizeCutAngle(value, defaultCutAngleForSystem(systemType));

export const COMBINATION_SYSTEM = "Combination";

export const buildDefaultSlidingPanelSashes = (count: number): SashType[] =>
  Array.from({ length: count }, (_, idx) => (idx % 2 === 0 ? "left" : "right"));

export const isLouverSystem = (systemType: string) => systemType === "Louvers";

export const isBlankSystem = (systemType: string) => systemType === "Blank Area";

export const getDefaultLeafDescription = (
  systemType: SystemType,
  productType: ProductMeta["productType"],
  hasExhaustFan = false
) => {
  if (isLouverSystem(systemType)) return "Louvers";
  if (isBlankSystem(systemType)) return "Blank Area";
  if (hasExhaustFan && systemType === "Casement") return "Fix";
  return `${systemType} ${productType}`;
};

export const getSectionLabel = (leaf: SectionNode, productType: ProductMeta["productType"]) =>
  leaf.description?.trim() || getDefaultLeafDescription(leaf.systemType, productType, leaf.hasExhaustFan);

export const DEFAULT_EXHAUST_FAN_X = 0.5;

export const DEFAULT_EXHAUST_FAN_Y = 0.5;

export const DEFAULT_EXHAUST_FAN_SIZE = 0.48;

export const DEFAULT_ARCH_HEIGHT_RATIO = 0.25;

export const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const normalizeArchType = (value: unknown): ArchType =>
  value === "circular" || value === "triangle" ? value : "none";

export const normalizeArchHeightRatio = (value: unknown) =>
  clampValue(Number(value) || DEFAULT_ARCH_HEIGHT_RATIO, 0.08, 0.45);

export const safeDrawSize = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

export const createRoot = (baseSystem: SystemType): SectionNode => ({
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
  description: isLouverSystem(baseSystem) ? "Louvers" : isBlankSystem(baseSystem) ? "Blank Area" : "",
  hasExhaustFan: false,
  exhaustFanX: DEFAULT_EXHAUST_FAN_X,
  exhaustFanY: DEFAULT_EXHAUST_FAN_Y,
  exhaustFanSize: DEFAULT_EXHAUST_FAN_SIZE,
  archType: "none",
  archHeightRatio: DEFAULT_ARCH_HEIGHT_RATIO,
  glass: "Yes",
  mesh: "No",
  frameCutAngle: defaultCutAngleForSystem(baseSystem),
  shutterCutAngle: defaultCutAngleForSystem(baseSystem),
});

export const createLeaf = (
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
  description: isLouverSystem(systemType) ? "Louvers" : "",
  hasExhaustFan: false,
  exhaustFanX: DEFAULT_EXHAUST_FAN_X,
  exhaustFanY: DEFAULT_EXHAUST_FAN_Y,
  exhaustFanSize: DEFAULT_EXHAUST_FAN_SIZE,
  // glass: "Yes",
  glass: isLouverSystem(systemType) ? "No" : glass,
  mesh,
  frameCutAngle: defaultCutAngleForSystem(systemType),
  shutterCutAngle: defaultCutAngleForSystem(systemType),
});

export const findNode = (node: SectionNode, id: string): SectionNode | null => {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
};

export const getResolvedSystemType = (
  root: SectionNode,
  nodeId: string
): SystemType | "Mixed" => {
  const node = findNode(root, nodeId);

  if (!node) return "Casement";

  const systems = new Set<SystemType>();

  mapLeafNodes(node, (leaf) => {
    systems.add(leaf.systemType);
  });

  if (systems.size === 1) {
    return [...systems][0];
  }

  return "Mixed";
};

export const resolveDividerValue = (
  root: SectionNode,
  leftId: string,
  rightId: string,
  selectedValue?: "C" | "M"
): "C" | "M" => {
  if (selectedValue) return selectedValue;
  return getResolvedSystemType(root, leftId) === "Casement" &&
    getResolvedSystemType(root, rightId) === "Casement"
    ? "M"
    : "C";
};

export const mapLeafNodes = (node: SectionNode, cb: (leaf: SectionNode) => void) => {
  if (!node.children || node.children.length === 0) {
    cb(node);
    return;
  }
  node.children.forEach((child) => mapLeafNodes(child, cb));
};

export const getArchTopRatioAtX = (archType: ArchType | undefined, archHeightRatio: number | undefined, xRatio: number) => {
  const normalizedArchType = normalizeArchType(archType);
  if (normalizedArchType === "none") return 0;

  const rise = normalizeArchHeightRatio(archHeightRatio);
  const t = clampValue(xRatio, 0, 1);

  if (normalizedArchType === "triangle") {
    return rise * Math.abs(1 - 2 * t);
  }

  return rise * ((1 - t) ** 2 + t ** 2);
};

export const getEffectiveLeafHeightRatio = (root: SectionNode, leaf: SectionNode) => {
  const archTopRatio = getArchTopRatioAtX(root.archType, root.archHeightRatio, leaf.x + leaf.w / 2);
  const leafTopRatio = Math.max(leaf.y, archTopRatio);
  return Math.max(0, leaf.y + leaf.h - leafTopRatio);
};

export const normalizeSystemType = (value?: string): SystemType => {
  if (value === "Exhaust Fan") return "Casement";
  if (
    value === "Sliding" ||
    value === "Slide N Fold" ||
    value === "Casement" ||
    value === "Louvers" ||
    value === "Blank Area"
  ) {
    return value;
  }
  return "Casement";
};

export const yesNoFromValue = (value?: string | boolean): YesNo => {
  if (value === true || value === "Yes") return "Yes";
  if (typeof value === "string" && value.trim() !== "" && value !== "No") return "Yes";
  return "No";
};

export const normalizeSashType = (value: unknown, fallback: SashType = "fixed"): SashType => {
  if (
    value === "fixed" ||
    value === "left" ||
    value === "right" ||
    value === "double" ||
    value === "top" ||
    value === "bottom"
  ) {
    return value;
  }
  return fallback;
};

export const normalizeSplitDirection = (value: unknown): SplitDirection => {
  if (value === "vertical" || value === "horizontal") return value;
  return "none";
};

export const normalizeStoredSectionNode = (value: unknown, fallbackSystemType: SystemType): SectionNode | null => {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const systemType = normalizeSystemType(typeof source.systemType === "string" ? source.systemType : fallbackSystemType);
  const children = Array.isArray(source.children)
    ? source.children
      .map((child) => normalizeStoredSectionNode(child, systemType))
      .filter((child): child is SectionNode => Boolean(child))
    : undefined;
  const split = children && children.length > 0 ? normalizeSplitDirection(source.split) : "none";
  const panelSashes = Array.isArray(source.panelSashes)
    ? source.panelSashes
      .map((value) => normalizeSashType(value, "fixed"))
      .filter(Boolean)
    : undefined;
  const dividerTypes =
    typeof source.dividerTypes === "object" && source.dividerTypes !== null
      ? Object.fromEntries(
        Object.entries(source.dividerTypes as Record<string, unknown>).map(([key, value]) => [key, value === "M" ? "M" : "C"] as const)
      ) as Record<string, "C" | "M">
      : undefined;

  return {
    id: typeof source.id === "string" && source.id ? source.id : crypto.randomUUID(),
    x: clampValue(Number(source.x) || 0, 0, 1),
    y: clampValue(Number(source.y) || 0, 0, 1),
    w: clampValue(Number(source.w) || 1, 0, 1),
    h: clampValue(Number(source.h) || 1, 0, 1),
    split,
    ratio: Number(source.ratio) || 0.5,
    sash: normalizeSashType(source.sash),
    systemType,
    series: typeof source.series === "string" ? source.series : "",
    description: typeof source.description === "string" ? source.description : "",
    hasExhaustFan: Boolean(source.hasExhaustFan),
    exhaustFanX: typeof source.exhaustFanX === "number" ? source.exhaustFanX : DEFAULT_EXHAUST_FAN_X,
    exhaustFanY: typeof source.exhaustFanY === "number" ? source.exhaustFanY : DEFAULT_EXHAUST_FAN_Y,
    exhaustFanSize: typeof source.exhaustFanSize === "number" ? source.exhaustFanSize : DEFAULT_EXHAUST_FAN_SIZE,
    panelFractions: Array.isArray(source.panelFractions)
      ? source.panelFractions.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0)
      : undefined,
    panelMeshCount: typeof source.panelMeshCount === "number" ? source.panelMeshCount : undefined,
    panelSashes,
    archType: systemType === "Casement" ? normalizeArchType(source.archType) : "none",
    archHeightRatio: normalizeArchHeightRatio(source.archHeightRatio),
    glass: yesNoFromValue(source.glass as string | boolean | undefined),
    mesh: yesNoFromValue(source.mesh as string | boolean | undefined),
    frameCutAngle: resolveCutAngleForSystem(systemType, source.frameCutAngle),
    shutterCutAngle: resolveCutAngleForSystem(systemType, source.shutterCutAngle),
    dividerTypes,
    children: split === "none" ? undefined : children,
  };
};

export const mapItemToConfiguratorState = (item: QuotationItem) => {
  const width = Math.round(item.width || 1500);
  const height = Math.round(item.height || 1500);
  const subItems = item.subItems ?? [];
  const hasSubItems = item.systemType === COMBINATION_SYSTEM && subItems.length > 1;
  const sourceSystem = hasSubItems
    ? normalizeSystemType(subItems[0]?.systemType)
    : normalizeSystemType(item.systemType);

  let root = createRoot(sourceSystem);
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
    if (hasExhaustFan && systemType === "Casement") return "Fix";
    return description;
  };

  const storedRoot = normalizeStoredSectionNode(item.configuratorLayout, sourceSystem);

  if (storedRoot) {
    root = storedRoot;

    // The backend replaces client-side sub-item ids with MongoDB ids when the
    // quotation is persisted. Keep the restored layout in that same identity
    // space so persisted joins can be matched to the rendered dividers.
    if (hasSubItems) {
      const storedLeaves: SectionNode[] = [];
      mapLeafNodes(root, (leaf) => storedLeaves.push(leaf));
      storedLeaves.forEach((leaf, index) => {
          const subItem = subItems.find((sub) => sub.id === leaf.id || sub._id === leaf.id) ?? subItems[index];
          const persistedId = subItem?.id || subItem?._id;
          if (persistedId) leaf.id = String(persistedId);
        });
    }
  } else if (hasSubItems) {
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
          childHasExhaustFan ? "Yes" : yesNoFromValue(sub.glassSpec),
          yesNoFromValue(sub.meshPresent)
        );
        child.series = sub.series || "";
        child.hasExhaustFan = childHasExhaustFan;
        child.exhaustFanX = typeof sub.exhaustFanX === "number" ? sub.exhaustFanX : DEFAULT_EXHAUST_FAN_X;
        child.exhaustFanY = typeof sub.exhaustFanY === "number" ? sub.exhaustFanY : DEFAULT_EXHAUST_FAN_Y;
        child.exhaustFanSize = typeof sub.exhaustFanSize === "number" ? sub.exhaustFanSize : DEFAULT_EXHAUST_FAN_SIZE;
        child.frameCutAngle = resolveCutAngleForSystem(normalizedSystemType, sub.frameCutAngle);
        child.shutterCutAngle = resolveCutAngleForSystem(normalizedSystemType, sub.shutterCutAngle);
        child.archType = normalizedSystemType === "Casement" ? normalizeArchType(sub.archType) : "none";
        child.archHeightRatio = normalizeArchHeightRatio(sub.archHeightRatio);
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
          childHasExhaustFan ? "Yes" : yesNoFromValue(sub.glassSpec),
          yesNoFromValue(sub.meshPresent)
        );
        child.series = sub.series || "";
        child.hasExhaustFan = childHasExhaustFan;
        child.exhaustFanX = typeof sub.exhaustFanX === "number" ? sub.exhaustFanX : DEFAULT_EXHAUST_FAN_X;
        child.exhaustFanY = typeof sub.exhaustFanY === "number" ? sub.exhaustFanY : DEFAULT_EXHAUST_FAN_Y;
        child.exhaustFanSize = typeof sub.exhaustFanSize === "number" ? sub.exhaustFanSize : DEFAULT_EXHAUST_FAN_SIZE;
        child.frameCutAngle = resolveCutAngleForSystem(normalizedSystemType, sub.frameCutAngle);
        child.shutterCutAngle = resolveCutAngleForSystem(normalizedSystemType, sub.shutterCutAngle);
        child.archType = normalizedSystemType === "Casement" ? normalizeArchType(sub.archType) : "none";
        child.archHeightRatio = normalizeArchHeightRatio(sub.archHeightRatio);
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
    root.archType = sourceSystem === "Casement" ? normalizeArchType(item.archType) : "none";
    root.archHeightRatio = normalizeArchHeightRatio(item.archHeightRatio);
    root.description = normalizeLeafDescription(sourceSystem, item.description || "", root.hasExhaustFan);
    root.glass = "Yes";
    root.mesh = yesNoFromValue(item.meshPresent);
    root.frameCutAngle = resolveCutAngleForSystem(sourceSystem, item.frameCutAngle);
    root.shutterCutAngle = resolveCutAngleForSystem(sourceSystem, item.shutterCutAngle);
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

  let dividerIndex = 0;
  const dividerTypes = { ...root.dividerTypes };
  const hydrateDividers = (node: SectionNode) => {
    if (node.children && node.children.length >= 2 && node.split !== "none") {
      for (let index = 0; index < node.children.length - 1; index += 1) {
        const id = `divider-${dividerIndex++}`;
        const join = item.joins?.find((entry) =>
          entry.p1 === node.children![index].id && entry.p2 === node.children![index + 1].id
        );
        if (join) dividerTypes[id] = join.type === "Mullion" ? "M" : "C";
      }
    }
    node.children?.forEach(hydrateDividers);
  };
  hydrateDividers(root);
  root.dividerTypes = dividerTypes;

  const meta: ProductMeta = {
    productType: item.productType === "Door" || item.productType === "Window"
      ? item.productType
      : item.height > 2200 ? "Door" : "Window",
    systemType: item.systemType || sourceSystem,
    series: item.series || "",
    description: item.description || "",
    colorFinish: item.colorFinish || "",
    glassSpec: item.glassSpec || DEFAULT_GLASS_SPEC,
    hardwareOpeningType: item.hardwareOpeningType || "hinges",
    handleType: item.handleType || "",
    handleColor: item.handleColor || DEFAULT_HANDLE_COLOR,
    meshPresent: yesNoFromValue(item.meshPresent),
    meshType: item.meshType || "",
    location: item.location || item.projectLocation || "",
    quantity: item.quantity || 1,
    refCode: item.refCode || "",
    remarks: item.remarks || item.specialNotes || "",
    rate: item.rate || 0,
    frameCutAngle: resolveCutAngleForSystem(sourceSystem, item.frameCutAngle),
    shutterCutAngle: resolveCutAngleForSystem(sourceSystem, item.shutterCutAngle),
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

export const drawSashGlyph = (
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

export const drawCasementSwingGuide = (
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

export const drawArchedPanel = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number,
  archType: ArchType,
  archHeightRatio: number,
  fill: string,
  stroke: string,
  opacity: number
) => {
  const safeW = safeDrawSize(w);
  const safeH = safeDrawSize(h);
  const rise = clampValue(archHeightRatio, 0.08, 0.45) * safeH;

  if (archType === "triangle") {
    group.add(
      new Konva.Line({
        points: [x, y + rise, x + safeW / 2, y, x + safeW, y + rise, x + safeW, y + safeH, x, y + safeH],
        closed: true,
        fill,
        stroke,
        strokeWidth: 1,
        opacity,
        listening: false,
      })
    );
    return;
  }

  if (archType === "circular") {
    group.add(
      new Konva.Shape({
        sceneFunc: (ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(x, y + rise);
          ctx.quadraticCurveTo(x + safeW / 2, y - rise * 0.7, x + safeW, y + rise);
          ctx.lineTo(x + safeW, y + safeH);
          ctx.lineTo(x, y + safeH);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        },
        fill,
        stroke,
        strokeWidth: 1,
        opacity,
        listening: false,
      })
    );
    return;
  }

  group.add(
    new Konva.Rect({
      x,
      y,
      width: safeW,
      height: safeH,
      fill,
      stroke,
      strokeWidth: 1,
      opacity,
      listening: false,
    })
  );
};

export const drawTiltTurnGuide = (
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

export const drawTopHungGuide = (
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

export const drawBottomHungGuide = (
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

export const drawFrenchGuide = (
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

export const drawSlideNFoldTwoPanelGuide = (
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

export const drawSlideNFoldThreePanelOnePlusTwoGuide = (
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

export const drawSlideNFoldFourPanelOnePlusThreeGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
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

export const drawSlideNFoldFivePanelOnePlusFourGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
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

export const drawSlideNFoldSixPanelOnePlusFiveGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
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

export const drawLouversGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number) => {
  const slatCount = Math.max(5, Math.min(8, Math.floor(h / 42)));
  const gap = h / (slatCount + 1);
  for (let idx = 0; idx < slatCount; idx += 1) {
    const topY = y + gap * (idx + 0.6);
    const bottomY = topY + Math.max(10, gap * 0.34);
    group.add(new Konva.Line({ points: [x + w * 0.06, topY, x + w * 0.94, topY], stroke: "#0F172A", strokeWidth: 2.2, listening: false }));
    group.add(new Konva.Line({ points: [x + w * 0.12, bottomY, x + w * 0.94, topY], stroke: "#0F172A", strokeWidth: 2.2, listening: false }));
  }
};

export const getExhaustFanGeometry = (x: number, y: number, w: number, h: number, centerXRatio = DEFAULT_EXHAUST_FAN_X, centerYRatio = DEFAULT_EXHAUST_FAN_Y, sizeRatio = DEFAULT_EXHAUST_FAN_SIZE) => {
  const safeW = Math.max(1, safeDrawSize(w));
  const safeH = Math.max(1, safeDrawSize(h));
  const fanSize = clampValue(sizeRatio, 0.2, 0.9);
  const centerX = x + safeW * clampValue(centerXRatio, 0.18, 0.82);
  const centerY = y + safeH * clampValue(centerYRatio, 0.18, 0.82);
  const radius = Math.max(0.5, Math.min(safeW, safeH) * fanSize * 0.5);
  const outerRadius = radius * 1.18;
  return { centerX, centerY, radius, outerRadius, diameter: outerRadius * 2 };
};

export const drawExhaustFanGuide = (group: KonvaGroup, x: number, y: number, w: number, h: number, centerXRatio = DEFAULT_EXHAUST_FAN_X, centerYRatio = DEFAULT_EXHAUST_FAN_Y, sizeRatio = DEFAULT_EXHAUST_FAN_SIZE) => {
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

export const drawBlankArea = (
  group: KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const clipGroup = new Konva.Group({
    clipX: x,
    clipY: y,
    clipWidth: w,
    clipHeight: h,
  });

  group.add(clipGroup);

  const brickWidth = 42;
  const brickHeight = 20;

  for (let row = 0; row < Math.ceil(h / brickHeight); row++) {
    const offset = row % 2 === 0 ? 0 : brickWidth / 2;

    for (let col = -1; col < Math.ceil(w / brickWidth) + 1; col++) {
      const brickX = x + col * brickWidth + offset;
      const brickY = y + row * brickHeight;
      // Stable texture: identical designs must produce identical saved images.
      const shade = ((row * 17 + (col + 1) * 13) % 20 + 20) % 20;
      const baseColor = `rgb(${200 - shade}, ${100 - shade}, ${60 - shade})`;

      clipGroup.add(
        new Konva.Rect({
          x: brickX,
          y: brickY,
          width: brickWidth - 2,
          height: brickHeight - 2,
          fill: baseColor,
          stroke: "#7a3b1c",
          strokeWidth: 1,
          cornerRadius: 2,
          listening: false,
        })
      );
      clipGroup.add(
        new Konva.Line({
          points: [
            brickX,
            brickY,
            brickX + brickWidth - 2,
            brickY
          ],
          stroke: "rgba(255,255,255,0.2)",
          strokeWidth: 1,
          listening: false,
        })
      );
    }
  }

  // outer border
  group.add(
    new Konva.Rect({
      x,
      y,
      width: w,
      height: h,
      stroke: "#555",
      strokeWidth: 1,
      listening: false,
    })
  );
};

export const parsePanelPattern = (desc: string): { fractions: number[]; meshCount?: number } | null => {
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

export const isSlideNFoldTwoPanelOnePlusOne = (desc: string) => /^2\s*Panel\s*\(\s*1\s*\+\s*1\s*\)$/i.test(desc);

export const isSlideNFoldThreePanelOnePlusTwo = (desc: string) => /^3\s*Panel\s*\(\s*1\s*\+\s*2\s*\)$/i.test(desc);

export const isSlideNFoldFourPanelOnePlusThree = (desc: string) => /^4\s*Panel\s*\(\s*1\s*\+\s*3\s*\)$/i.test(desc);

export const isSlideNFoldFivePanelOnePlusFour = (desc: string) => /^5\s*Panel\s*\(\s*1\s*\+\s*4\s*\)$/i.test(desc);

export const isSlideNFoldSixPanelOnePlusFive = (desc: string) => /^6\s*Panel\s*\(\s*1\s*\+\s*5\s*\)$/i.test(desc);

export const COLORS = {
  bg: "#FFFFFF",
  grid: "#CBD5E1",
  frameDark: "#64748B",
  frameMid: "#94A3B8",
  frameLight: "#E2E8F0",
  glass: "#E0F2FE",
  glassStroke: "#64748B",
  labelStroke: "#0F172A",
  labelFill: "#FFFFFF",
  mesh: "#475569",
  text: "#0F172A",
  selected: "#4A3525",
  handleStroke: "#0F172A",
};

export function resolveFrameColor(colorFinishName?: string, explicitColor?: string): string {
  if (typeof explicitColor === "string" && /^#[0-9a-f]{6}$/i.test(explicitColor)) {
    return explicitColor;
  }
  const name = String(colorFinishName || "").trim().toLowerCase();
  if (!name) return COLORS.frameDark;

  const hexMatch = name.match(/#([0-9a-f]{6})\b/i);
  if (hexMatch) return `#${hexMatch[1]}`;

  if (name.includes("champagne")) return "#C5A059";
  if (name.includes("bronze")) return "#5B4033";
  if (name.includes("black")) return "#1E232A";
  if (name.includes("white")) return "#ECEFF1";
  if (name.includes("wenge")) return "#3B2618";
  if (name.includes("teak") || name.includes("wood")) return "#6D4C41";
  if (name.includes("walnut")) return "#4E342E";
  if (name.includes("oak")) return "#A17238";
  if (name.includes("silver") || name.includes("natural")) return "#9CA3AF";
  if (name.includes("grey") || name.includes("gray")) {
    if (name.includes("2200")) return "#64748B";
    if (name.includes("2900")) return "#475569";
    if (name.includes("dark") || name.includes("anthracite")) return "#374151";
    return "#5B6777";
  }
  if (name.includes("anthracite")) return "#2E3440";
  if (name.includes("ivory") || name.includes("beige") || name.includes("cream")) return "#E8D8C8";
  if (name.includes("charcoal")) return "#2D3748";
  if (name.includes("brown")) return "#4E342E";
  if (name.includes("gold")) return "#D4AF37";

  return COLORS.frameDark;
}

export const PROFILE = { outer: 10, inner: 4, mullion: 8, sash: 6, gap: 2 };

export const applyArchPath = (
  ctx: PathContext,
  x: number,
  y: number,
  w: number,
  h: number,
  archType: ArchType,
  archHeightRatio: number
) => {
  const safeW = safeDrawSize(w);
  const safeH = safeDrawSize(h);
  const rise = normalizeArchType(archType) === "none" ? 0 : normalizeArchHeightRatio(archHeightRatio) * safeH;

  ctx.beginPath();
  ctx.moveTo(x, y + safeH);
  ctx.lineTo(x, y + rise);
  if (archType === "triangle") {
    ctx.lineTo(x + safeW / 2, y);
    ctx.lineTo(x + safeW, y + rise);
  } else if (archType === "circular") {
    ctx.quadraticCurveTo(x + safeW / 2, y, x + safeW, y + rise);
  } else {
    ctx.lineTo(x, y);
    ctx.lineTo(x + safeW, y);
  }
  ctx.lineTo(x + safeW, y + safeH);
  ctx.closePath();
};

export const addArchShape = (
  layer: KonvaLayer | KonvaGroup,
  x: number,
  y: number,
  w: number,
  h: number,
  archType: ArchType,
  archHeightRatio: number,
  stroke: string,
  strokeWidth: number,
  opacity = 1,
  dash?: number[]
) => {
  layer.add(
    new Konva.Shape({
      sceneFunc: (ctx, shape) => {
        applyArchPath(ctx, x, y, w, h, archType, archHeightRatio);
        ctx.fillStrokeShape(shape);
      },
      stroke,
      strokeWidth,
      dash,
      opacity,
      listening: false,
    })
  );
};

export function addProfileRect(layer: KonvaLayer | KonvaGroup, x: number, y: number, w: number, h: number, selected = false, archType: ArchType = "none", archHeightRatio = DEFAULT_ARCH_HEIGHT_RATIO, frameColor = COLORS.frameDark) {
  const safeW = safeDrawSize(w);
  const safeH = safeDrawSize(h);
  const normalizedArchType = normalizeArchType(archType);
  if (normalizedArchType === "none") {
   
    layer.add(new Konva.Rect({ x, y, width: safeW, height: safeH, stroke: frameColor, strokeWidth: PROFILE.outer, listening: false }));
    layer.add(new Konva.Rect({ x: x + PROFILE.outer / 2 + 2, y: y + PROFILE.outer / 2 + 2, width: safeDrawSize(safeW - (PROFILE.outer + 4)), height: safeDrawSize(safeH - (PROFILE.outer + 4)), stroke: frameColor, strokeWidth: PROFILE.inner, listening: false }));
    layer.add(new Konva.Rect({ x: x + PROFILE.outer / 2 + 6, y: y + PROFILE.outer / 2 + 6, width: safeDrawSize(safeW - (PROFILE.outer + 12)), height: safeDrawSize(safeH - (PROFILE.outer + 12)), stroke: frameColor, strokeWidth: 1, opacity: 0.6, listening: false }));
    if (selected) {
      const margin = 16;
      layer.add(new Konva.Rect({
        x: x - margin,
        y: y - margin,
        width: safeDrawSize(safeW + margin * 2),
        height: safeDrawSize(safeH + margin * 2),
        stroke: frameColor,
        strokeWidth: 2,
        dash: [8, 5],
        listening: false,
      }));
    }
    return;
  }

  // addArchShape(layer, x, y, safeW, safeH, normalizedArchType, archHeightRatio, selected ? COLORS.selected : frameColor, PROFILE.outer);
   addArchShape(layer, x, y, safeW, safeH, normalizedArchType, archHeightRatio, frameColor, PROFILE.outer);
   const innerOffset = PROFILE.outer / 2 + 2;
 
  addArchShape(layer, x + innerOffset, y + innerOffset, safeDrawSize(safeW - innerOffset * 2), safeDrawSize(safeH - innerOffset * 2), normalizedArchType, archHeightRatio, frameColor, PROFILE.inner);
  const highlightOffset = PROFILE.outer / 2 + 6;
  addArchShape(layer, x + highlightOffset, y + highlightOffset, safeDrawSize(safeW - highlightOffset * 2), safeDrawSize(safeH - highlightOffset * 2), normalizedArchType, archHeightRatio, frameColor, 1, 0.6);

  if (selected) {
    const margin = 16;
    addArchShape(layer, x - margin, y - margin, safeDrawSize(safeW + margin * 2), safeDrawSize(safeH + margin * 2), normalizedArchType, archHeightRatio, frameColor, 2, 1, [8, 5]);
  }
}

export function addMemberRect(layer: KonvaLayer | KonvaGroup, x: number, y: number, w: number, h: number, frameColor = COLORS.frameDark) {
  const safeW = safeDrawSize(w);
  const safeH = safeDrawSize(h);
  layer.add(new Konva.Rect({ x, y, width: safeW, height: safeH, fill: frameColor, stroke: frameColor, strokeWidth: 1, listening: false }));
}

export function addSectionHeader(group: KonvaGroup, x: number, y: number, text: string, maxW?: number) {
  if (!text) return;
  const padX = 6;
  const padY = 3;
  const availableW = maxW ? Math.max(24, maxW - 12) : undefined;
  
  let fontSize = 11;
  if (availableW && availableW < 80) {
    fontSize = 9;
  } else if (availableW && availableW < 130) {
    fontSize = 10;
  }
  
  const t = new Konva.Text({
    x: x + padX,
    y: y + padY,
    text,
    fontSize,
    fontStyle: "bold",
    fill: "#0F172A",
    listening: false,
  });
  
  const naturalW = t.width() + padX * 2;
  if (availableW && naturalW > availableW) {
    t.width(availableW - padX * 2);
    t.ellipsis(true);
    t.wrap("none");
  }
  
  const bgW = availableW ? Math.min(availableW, naturalW) : naturalW;
  const bgH = t.height() + padY * 2;
  
  group.add(
    new Konva.Rect({
      x,
      y,
      width: bgW,
      height: bgH,
      fill: "rgba(255, 255, 255, 0.95)",
      stroke: "#94A3B8",
      strokeWidth: 1,
      cornerRadius: 3,
      shadowColor: "rgba(0, 0, 0, 0.05)",
      shadowBlur: 2,
      shadowOffsetY: 1,
      listening: false,
    })
  );
  group.add(t);
}

export function addTag(layer: KonvaLayer | KonvaGroup, x: number, y: number, text: string) {
  const padX = 6;
  const padY = 4;
  const t = new Konva.Text({ x, y, text, fontSize: 13, fontStyle: "bold", fill: "#0F172A", listening: false });
  const w = t.width() + padX * 2;
  const h = t.height() + padY * 2;
  layer.add(new Konva.Rect({ x: x - padX, y: y - padY, width: w, height: h, fill: COLORS.labelFill, stroke: "#0F172A", strokeWidth: 1.2, cornerRadius: 2, listening: false }));
  layer.add(t);
}

export function addHandleIcon(layer: KonvaLayer | KonvaGroup, x: number, y: number, side: "left" | "right" | "top" | "bottom") {
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

export function addDimensionLine(layer: KonvaLayer | KonvaGroup, x1: number, y1: number, x2: number, y2: number, label: string, showLabel = true) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const arrowStyle = { stroke: "#111827", fill: "#111827", strokeWidth: 2.5, pointerLength: 10, pointerWidth: 10, listening: false };
  const isHorizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  if (isHorizontal) {
    const gapHalf = Math.min(95, Math.abs(x2 - x1) * 0.4);
    layer.add(new Konva.Arrow({ points: [midX - gapHalf, midY, x1, y1], ...arrowStyle }));
    layer.add(new Konva.Arrow({ points: [midX + gapHalf, midY, x2, y2], ...arrowStyle }));
  } else {
    const gapHalf = Math.min(36, Math.abs(y2 - y1) * 0.3);
    layer.add(new Konva.Arrow({ points: [midX, midY - gapHalf, x1, y1], ...arrowStyle }));
    layer.add(new Konva.Arrow({ points: [midX, midY + gapHalf, x2, y2], ...arrowStyle }));
  }
  if (showLabel) {
    layer.add(new Konva.Text({
      x: isHorizontal ? midX - 70 : midX - 98,
      y: midY - 18,
      width: isHorizontal ? 140 : 80,
      align: isHorizontal ? "center" : "right",
      text: label,
      fontSize: 32,
      fontStyle: "normal",
      fill: "#111827",
      listening: false,
    }));
  }
}

export function drawMeshTriangle(group: KonvaGroup, x: number, y: number, size: number) {
  const meshSize = Math.max(38, size);
  const topX = x;
  const topY = y - meshSize;
  const leftX = x - meshSize;
  const leftY = y;
  // Mesh background shade to make the mesh area clearly slightly darker and visible
  group.add(
    new Konva.Line({
      points: [leftX, leftY, x, y, topX, topY, leftX, leftY],
      closed: true,
      fill: "rgba(15, 23, 42, 0.14)",
      stroke: "#0F172A",
      strokeWidth: 1.5,
      listening: false,
    })
  );
  const step = Math.max(6, Math.round(meshSize / 7));
  for (let i = step; i < meshSize; i += step) {
    group.add(
      new Konva.Line({
        points: [x - i, y, x, y - i],
        stroke: "#0F172A",
        strokeWidth: 1.2,
        opacity: 0.95,
        listening: false,
      })
    );
  }
  for (let i = step; i < meshSize; i += step) {
    group.add(
      new Konva.Line({
        points: [x - i, y, x - i, y - (meshSize - i)],
        stroke: "#0F172A",
        strokeWidth: 1.2,
        opacity: 0.95,
        listening: false,
      })
    );
  }
}


export type DesignView = { offsetX: number; offsetY: number; drawW: number; drawH: number };
export type DividerSelection = { id: string; leftId: string; rightId: string };

type RenderWindowDoorDesignOptions = {
  layer: KonvaLayer;
  stageSize: { w: number; h: number };
  view: DesignView;
  root: SectionNode;
  widthMm: number;
  heightMm: number;
  meta: Pick<ProductMeta, "productType" | "systemType" | "description">;
  baseSystemType: SystemType;
  selectedFrameColor: string;
  hideSelectionForExport?: boolean;
  selectedId?: string | null;
  selectedSlidingPanelIndex?: number | null;
  badgeValues?: Record<string, "C" | "M">;
  setSelectedId?: (id: string | null) => void;
  setSelectedSlidingPanelIndex?: (index: number | null) => void;
  setSelectedDivider?: (divider: DividerSelection | null) => void;
  onPanStart?: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onPanEnter?: () => void;
  onPanLeave?: () => void;
};

// The interactive canvas and saved images use this same drawing implementation.
export function renderWindowDoorDesign({
  layer, stageSize, view, root, widthMm, heightMm, meta, baseSystemType,
  selectedFrameColor, hideSelectionForExport = true, selectedId = null,
  selectedSlidingPanelIndex = null, badgeValues = root.dividerTypes ?? {},
  setSelectedId = () => {}, setSelectedSlidingPanelIndex = () => {},
  setSelectedDivider = () => {}, onPanStart, onPanEnter, onPanLeave,
}: RenderWindowDoorDesignOptions) {
    layer.destroyChildren();
    layer.add(new Konva.Rect({ x: 0, y: 0, width: stageSize.w, height: stageSize.h, fill: COLORS.bg }));
    const panHit = new Konva.Rect({ x: 0, y: 0, width: stageSize.w, height: stageSize.h, fill: "rgba(255,255,255,0.001)", listening: true });
    if (onPanStart) panHit.on("mousedown touchstart", onPanStart);
    if (onPanEnter) panHit.on("mouseenter", onPanEnter);
    if (onPanLeave) panHit.on("mouseleave", onPanLeave);
    layer.add(panHit);
    // const gridGroup = new Konva.Group();
    // gridGroupRef.current = gridGroup;
    // layer.add(gridGroup);
    // const gridSize = 20;
    // for (let x = 0; x <= stageSize.w; x += gridSize) gridGroup.add(new Konva.Line({ points: [x, 0, x, stageSize.h], stroke: COLORS.grid, strokeWidth: x % (gridSize * 5) === 0 ? 1.2 : 0.6, listening: false }));
    // for (let y = 0; y <= stageSize.h; y += gridSize) gridGroup.add(new Konva.Line({ points: [0, y, stageSize.w, y], stroke: COLORS.grid, strokeWidth: y % (gridSize * 5) === 0 ? 1.2 : 0.6, listening: false }));
    const fx = view.offsetX;
    const fy = view.offsetY;
    const fw = view.drawW;
    const fh = view.drawH;
    const selectedForRender = hideSelectionForExport ? null : selectedId;
    const rootArchType = normalizeArchType(root.archType);
    const rootArchHeightRatio = normalizeArchHeightRatio(root.archHeightRatio);
    addProfileRect(layer, fx, fy, fw, fh, selectedForRender === "root", rootArchType, rootArchHeightRatio, selectedFrameColor);
    const rootHit = new Konva.Rect({ x: fx, y: fy, width: fw, height: fh, fill: "transparent" });
    rootHit.on("mousedown touchstart", () => { setSelectedDivider(null); setSelectedId("root"); setSelectedSlidingPanelIndex(null); });
    layer.add(rootHit);
    const contentGroup = new Konva.Group({
      clipFunc: (ctx) => {
        const inset = PROFILE.outer;
        applyArchPath(
          ctx,
          fx + inset,
          fy + inset,
          safeDrawSize(fw - inset * 2),
          safeDrawSize(fh - inset * 2),
          rootArchType,
          rootArchHeightRatio
        );
      },
    });
    layer.add(contentGroup);
    const sectionBadgeOverlay = new Konva.Group({ listening: false });
    const dividerBadges: {
      id: string; x: number; y: number;
      // leftSystem: SystemType;rightSystem: SystemType;
      leftId: string;
      rightId: string;
      orientation: "vertical" | "horizontal";
    }[] = [];
    const drawParentDividers = (parent: SectionNode) => {
      if (!parent.children || parent.children.length < 2) return;
      const dir = parent.split;
      if (dir !== "vertical" && dir !== "horizontal") return;
      for (let i = 0; i < parent.children.length - 1; i++) {
        const a = parent.children[i];
        const b = parent.children[i + 1];
        const boundary = dir === "vertical" ? a.x + a.w : a.y + a.h;
        if (dir === "vertical") {
          const x = fx + boundary * fw;
          const memberY = fy + parent.y * fh + PROFILE.outer;
          const memberHeight = parent.h * fh - PROFILE.outer * 2;
          addMemberRect(
            contentGroup,
            x - PROFILE.mullion / 2,
            memberY,
            PROFILE.mullion,
            memberHeight,
            selectedFrameColor
          );
          dividerBadges.push({
            id: `divider-${dividerBadges.length}`,
            x,
            y: fy + (parent.y + parent.h / 2) * fh,
            leftId: a.id,
            rightId: b.id,
            orientation: "vertical",
          });
        } else {
          const y = fy + boundary * fh;
          const memberX = fx + parent.x * fw + PROFILE.outer;
          const memberWidth = parent.w * fw - PROFILE.outer * 2;
          addMemberRect(
            contentGroup,
            memberX,
            y - PROFILE.mullion / 2,
            memberWidth,
            PROFILE.mullion,
            selectedFrameColor
          );
          dividerBadges.push({
            id: `divider-${dividerBadges.length}`,
            x: fx + (parent.x + parent.w / 2) * fw,
            y,
            leftId: a.id,
            rightId: b.id,
            orientation: "horizontal",
          });
        }
      }
      parent.children.forEach(drawParentDividers);
    };
    const leaves: SectionNode[] = [];
    mapLeafNodes(root, (leaf) => leaves.push(leaf));
    leaves.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    leaves.forEach((leaf, idx) => {
      const x = fx + leaf.x * fw;
      const y = fy + leaf.y * fh;
      const w = safeDrawSize(leaf.w * fw);
      const h = safeDrawSize(leaf.h * fh);
      const isSelected = leaf.id === selectedForRender;
      const g = new Konva.Group({ listening: true, draggable: false });
      const leafHit = new Konva.Rect({ x, y, width: w, height: h, fill: "rgba(255,255,255,0.01)", listening: true });
      leafHit.on("mousedown touchstart", (event) => {
        event.cancelBubble = true;
        setSelectedDivider(null);
        setSelectedId(leaf.id);
        setSelectedSlidingPanelIndex(null);
      });
      g.add(leafHit);
      const isTouchingLeft = leaf.x <= 0.001;
      const isTouchingRight = leaf.x + leaf.w >= 0.999;
      const isTouchingTop = leaf.y <= 0.001;
      const isTouchingBottom = leaf.y + leaf.h >= 0.999;

      const padLeft = (isTouchingLeft ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap + PROFILE.sash / 2;
      const padRight = (isTouchingRight ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap + PROFILE.sash / 2;
      const padTop = (isTouchingTop ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap + PROFILE.sash / 2;
      const padBottom = (isTouchingBottom ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap + PROFILE.sash / 2;

      const sashX = x + padLeft;
      const sashY = y + padTop;
      const sashW = safeDrawSize(w - padLeft - padRight);
      const sashH = safeDrawSize(h - padTop - padBottom);
      const blankPadLeft = (isTouchingLeft ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap;
      const blankPadRight = (isTouchingRight ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap;
      const blankPadTop = (isTouchingTop ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap;
      const blankPadBottom = (isTouchingBottom ? PROFILE.outer / 2 : PROFILE.mullion / 2) + PROFILE.gap;
      const blankBounds = {
        x: x + blankPadLeft,
        y: y + blankPadTop,
        w: safeDrawSize(w - blankPadLeft - blankPadRight),
        h: safeDrawSize(h - blankPadTop - blankPadBottom),
      };
      if (leaf.systemType !== "Blank Area") {
     
      g.add(new Konva.Rect({
          x: sashX,
          y: sashY,
          width: sashW,
          height: sashH,
          stroke: selectedFrameColor,
          strokeWidth: 2,
          listening: false
        }));
      }

      const inset = PROFILE.sash / 2 + 4;
      const innerBounds = {
        x: sashX + inset,
        y: sashY + inset,
        w: safeDrawSize(sashW - inset * 2),
        h: safeDrawSize(sashH - inset * 2),
      };
      const isSlidingSystem =
        leaf.systemType === "Sliding" ||
        meta.systemType === "Sliding" ||
        baseSystemType === "Sliding" ||
        /track|sliding|glass.*mesh|mesh.*glass|panel/i.test(leaf.description || "") ||
        /track|sliding|glass.*mesh|mesh.*glass|panel/i.test(meta.description || "");
      const handledByDescription = (() => {
        const desc = leaf.description;
        if (!desc) return false;
        const { x: innerX, y: innerY, w: innerW, h: innerH } = innerBounds;
        const fixedPanel = (px: number, py: number, pw: number, ph: number, strokeColor?: string) =>
          drawArchedPanel(
            g,
            px,
            py,
            pw,
            ph,
            "none",
            DEFAULT_ARCH_HEIGHT_RATIO,
            leaf.glass === "Yes" ? COLORS.glass : "#FFFFFF",
            strokeColor ?? selectedFrameColor,
            leaf.glass === "Yes" ? 0.85 : 0.6
          );
        const drawPanels = (fractions: number[], sashTypes?: SashType[], meshCount = 0) => {
          const isPanelizedSliding = isSlidingSystem || fractions.length > 1;
          const panelSashes = isPanelizedSliding ? (leaf.panelSashes && leaf.panelSashes.length === fractions.length ? leaf.panelSashes : buildDefaultSlidingPanelSashes(fractions.length)) : [];
          let cursor = innerX;
          const splitLineWidth = PROFILE.mullion; // 7.5px (between half [5px] and frame width [10px])
          let selectedPanelRect: { x: number; y: number; w: number; height: number } | null = null;
          fractions.forEach((frac, idx) => {
            const pw = innerW * frac;
            fixedPanel(cursor, innerY, pw, innerH, selectedFrameColor);
            if (sashTypes?.[idx]) drawSashGlyph(g, cursor, innerY, pw, innerH, sashTypes[idx], selectedFrameColor);
            if (isPanelizedSliding) {
              const panelSash = panelSashes[idx] ?? "fixed";
              const arrowY = innerY + innerH / 2;
              if (panelSash === "double") {
                g.add(new Konva.Arrow({ points: [cursor + pw * 0.5, arrowY, cursor + pw * 0.25, arrowY], stroke: "#0F172A", fill: "#0F172A", strokeWidth: 1.6, pointerLength: 8, pointerWidth: 8, opacity: 0.95, listening: false }));
                g.add(new Konva.Arrow({ points: [cursor + pw * 0.5, arrowY, cursor + pw * 0.75, arrowY], stroke: "#0F172A", fill: "#0F172A", strokeWidth: 1.6, pointerLength: 8, pointerWidth: 8, opacity: 0.95, listening: false }));
              } else if (panelSash === "left" || panelSash === "right") {
                const from = panelSash === "left" ? cursor + pw * 0.75 : cursor + pw * 0.25;
                const to = panelSash === "left" ? cursor + pw * 0.25 : cursor + pw * 0.75;
                g.add(new Konva.Arrow({ points: [from, arrowY, to, arrowY], stroke: "#0F172A", fill: "#0F172A", strokeWidth: 1.6, pointerLength: 8, pointerWidth: 8, opacity: 0.95, listening: false }));
              }
              // const panelHit = new Konva.Rect({ x: cursor, y: innerY, width: pw, height: innerH, fill: "rgba(255,255,255,0.001)", stroke: isSelected && selectedSlidingPanelIndex === idx ? COLORS.selected : "rgb(30, 30, 30)", strokeWidth: 7, listening: true });
              const isPanelSelected = isSelected && selectedSlidingPanelIndex === idx;
              const panelHit = new Konva.Rect({ x: cursor, y: innerY, width: pw, height: innerH, fill: "rgba(255,255,255,0.001)", stroke: "transparent", listening: true });
              panelHit.on("mousedown touchstart", (event) => { event.cancelBubble = true; setSelectedDivider(null); setSelectedId(leaf.id); setSelectedSlidingPanelIndex(idx); });
              g.add(panelHit);
              if (isPanelSelected) {
                const margin = 10;
                selectedPanelRect = {
                  x: cursor + margin,
                  y: innerY + margin,
                  w: safeDrawSize(pw - margin * 2),
                  height: safeDrawSize(innerH - margin * 2),
                };
              }
            }
            if (meshCount > 0 && idx >= fractions.length - meshCount) drawMeshTriangle(g, cursor + pw - 6, innerY + innerH - 6, Math.min(pw, innerH) * 0.5);
            cursor += pw;
          });
          // Draw split line meeting stiles AFTER all panels are rendered so no semi-transparent glass overlaps them
          let splitCursor = innerX;
          const splitWidth = Math.round(splitLineWidth);
          for (let i = 0; i < fractions.length - 1; i++) {
            splitCursor += innerW * fractions[i];
            const sx = Math.round(splitCursor - splitWidth / 2);
            g.add(
              new Konva.Rect({
                x: sx,
                y: innerY,
                width: splitWidth,
                height: innerH,
                fill: selectedFrameColor,
                stroke: selectedFrameColor,
                strokeWidth: 0,
                listening: false,
              })
            );
          }
          const panelSelection = selectedPanelRect as { x: number; y: number; w: number; height: number } | null;
          if (panelSelection) {
            g.add(
              new Konva.Rect({
                x: panelSelection.x,
                y: panelSelection.y,
                width: panelSelection.w,
                height: panelSelection.height,
                stroke: selectedFrameColor,
                strokeWidth: 2.5,
                dash: [8, 5],
                listening: false,
              })
            );
          }
        };
        const isOneOf = (...variants: string[]) => variants.includes(desc);
        if (leaf.systemType === "Louvers" || desc === "Louvers") { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawLouversGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.hasExhaustFan) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawExhaustFanGuide(g, innerX, innerY, innerW, innerH, leaf.exhaustFanX, leaf.exhaustFanY, leaf.exhaustFanSize); return true; }
        if (isBlankSystem(leaf.systemType) || desc === "Blank Area") {
          drawBlankArea(g, blankBounds.x, blankBounds.y, blankBounds.w, blankBounds.h);
          return true;
        }
        if (desc === "Fix") { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); return true; }
        if (isOneOf("Left Openable", "Left Openable Door-Window", "Left Openable Window", "Left Openable Door", "Outward Window L", "Outward Door L", "Inward Door L", "Inward Window L")) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawCasementSwingGuide(g, innerX, innerY, innerW, innerH, "left"); return true; }
        if (isOneOf("Right Openable", "Right Openable Door-Window", "Right Openable Window", "Right Openable Door", "Outward Window R", "Outward Door R", "Inward Door R", "Inward Window R")) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawCasementSwingGuide(g, innerX, innerY, innerW, innerH, "right"); return true; }
        if (desc === "Top Hung Window") { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawTopHungGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (desc === "Bottom Hung Window") { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawBottomHungGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (desc === "Parallel Window") { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawSashGlyph(g, innerX, innerY, innerW, innerH, "double", selectedFrameColor); return true; }
        if (desc === "Tilt and Turn Window") { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawTiltTurnGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (isOneOf("French Door-Window", "French Door", "French Window")) {
          const centerGap = Math.max(10, Math.min(22, innerW * 0.05));
          const panelW = (innerW - centerGap) / 2;
          fixedPanel(innerX, innerY, panelW, innerH, selectedFrameColor);
          fixedPanel(innerX + panelW + centerGap, innerY, panelW, innerH, selectedFrameColor);
          drawFrenchGuide(g, innerX, innerY, innerW, innerH);
          return true;
        }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldTwoPanelOnePlusOne(desc)) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawSlideNFoldTwoPanelGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldThreePanelOnePlusTwo(desc)) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawSlideNFoldThreePanelOnePlusTwoGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldFourPanelOnePlusThree(desc)) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawSlideNFoldFourPanelOnePlusThreeGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldFivePanelOnePlusFour(desc)) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawSlideNFoldFivePanelOnePlusFourGuide(g, innerX, innerY, innerW, innerH); return true; }
        if (leaf.systemType === "Slide N Fold" && isSlideNFoldSixPanelOnePlusFive(desc)) { fixedPanel(innerX, innerY, innerW, innerH, selectedFrameColor); drawSlideNFoldSixPanelOnePlusFiveGuide(g, innerX, innerY, innerW, innerH); return true; }
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
      if (!handledByDescription) {
        drawArchedPanel(
          g,
          innerBounds.x,
          innerBounds.y,
          innerBounds.w,
          innerBounds.h,
          "none",
          DEFAULT_ARCH_HEIGHT_RATIO,
          leaf.glass === "Yes" ? COLORS.glass : "#FFFFFF",
          selectedFrameColor,
          leaf.glass === "Yes" ? 0.85 : 0.6
        );
      }
      const parsedPattern = parsePanelPattern(leaf.description || "");
      const hasPatternMesh = (leaf.panelMeshCount ?? parsedPattern?.meshCount ?? 0) > 0;
      if (leaf.mesh === "Yes" && !hasPatternMesh) drawMeshTriangle(g, x + w - inset - 6, y + h - inset - 6, Math.min(w, h) * 0.5);
      const insetHandle = inset + 6;
      const isSliding = leaf.systemType === "Sliding";
      const hasSlidingPanels = isSliding && (leaf.panelFractions?.length ?? 0) > 1;
      const isSlideFold = leaf.systemType === "Slide N Fold";
      const isLouver = leaf.systemType === "Louvers";
      const isExhaust = Boolean(leaf.hasExhaustFan);
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
          g.add(new Konva.Arrow({ points: [x + w * 0.5, arrowY, x + w * 0.28, arrowY], stroke: "#0F172A", fill: "#0F172A", strokeWidth: 1.6, pointerLength: 8, pointerWidth: 8, opacity: 0.95, listening: false }));
          g.add(new Konva.Arrow({ points: [x + w * 0.5, arrowY, x + w * 0.72, arrowY], stroke: "#0F172A", fill: "#0F172A", strokeWidth: 1.6, pointerLength: 8, pointerWidth: 8, opacity: 0.95, listening: false }));
        } else {
          const from = leaf.sash === "left" ? x + w * 0.72 : x + w * 0.28;
          const to = leaf.sash === "left" ? x + w * 0.28 : x + w * 0.72;
          g.add(new Konva.Arrow({ points: [from, arrowY, to, arrowY], stroke: "#0F172A", fill: "#0F172A", strokeWidth: 1.6, pointerLength: 8, pointerWidth: 8, opacity: 0.95, listening: false }));
        }
      }
      if (isSliding) g.add(new Konva.Line({ points: [x + inset, y + h - (PROFILE.outer / 2 + 6), x + w - inset, y + h - (PROFILE.outer / 2 + 6)], stroke: "#475569", strokeWidth: 0.6, opacity: 0.8, listening: false }));
      if (isSlideFold && !isCustomSlideNFoldPattern) {
        const foldX = x + w * 0.72;
        g.add(new Konva.Line({ points: [foldX, y + inset, foldX, y + h - inset], stroke: "#334155", strokeWidth: 0.6, dash: [4, 3], opacity: 0.8, listening: false }));
        g.add(new Konva.Arrow({ points: [foldX - 18, y + h * 0.2, foldX + 18, y + h * 0.2], stroke: "#111827", fill: "#111827", strokeWidth: 0.6, pointerLength: 6, pointerWidth: 6, opacity: 0.65, listening: false }));
      }
      addSectionHeader(g, innerBounds.x + 6, innerBounds.y + 6, getSectionLabel(leaf, meta.productType), innerBounds.w);
      // A centered number badge hides the exhaust fan almost completely in
      // compact sections. Keep the badge in the lower-right corner instead,
      // and omit it when there is not enough room for both visual elements.
      const showSectionBadge = !isExhaust || Math.min(innerBounds.w, innerBounds.h) >= 52;
      if (showSectionBadge) {
        const badgeRadius = isExhaust
          ? Math.max(8, Math.min(11, Math.min(innerBounds.w, innerBounds.h) / 7))
          : 14;
        const badgeX = isExhaust
          ? innerBounds.x + innerBounds.w - badgeRadius - 3
          : x + w / 2;
        const badgeY = isExhaust
          ? innerBounds.y + innerBounds.h - badgeRadius - 3
          : y + h / 2;
        sectionBadgeOverlay.add(new Konva.Circle({ x: badgeX, y: badgeY, radius: badgeRadius, fill: "#FFFFFF", stroke: "#334155", strokeWidth: 1.5, shadowColor: "rgba(0,0,0,0.06)", shadowBlur: 2, listening: false }));
        sectionBadgeOverlay.add(new Konva.Text({ x: badgeX - badgeRadius, y: badgeY - 6, width: badgeRadius * 2, align: "center", text: String(idx + 1), fontSize: isExhaust ? 10 : 12, fontStyle: "bold", fill: "#0F172A", listening: false }));
      }
      contentGroup.add(g);
    });


    // Draw frame dividers above the panels so glass cannot cover them.
    drawParentDividers(root);
    const dividerBadgeOverlay = new Konva.Group();
    dividerBadges.forEach(({ id, x, y, leftId, rightId }) => {
      const badgeGroup = new Konva.Group({
        listening: true,
      });

      const circle = new Konva.Circle({
        x,
        y,
        radius: 14,
        fill: "#111111",
        stroke: "#FFD700",
        strokeWidth: 2,
      });
      // const displayValue =
      // leftSystem === "Casement" && rightSystem === "Casement"
      //   ? "M"
      //   : leftSystem === "Sliding" && rightSystem === "Sliding"
      //   ? "C"
      //   : badgeValues[id] ?? "C";
      const displayValue = resolveDividerValue(root, leftId, rightId, badgeValues[id]);

      const text = new Konva.Text({
        x: x - 14,
        y: y - 8,
        width: 28,
        align: "center",
        text: displayValue,
        fontSize: 13,
        fontStyle: "bold",
        fill: "#FFFFFF",
      });

      badgeGroup.add(circle);
      badgeGroup.add(text);

      badgeGroup.on("mousedown touchstart", (e) => {
        e.cancelBubble = true;
        setSelectedId(null);
        setSelectedSlidingPanelIndex(null);
        setSelectedDivider({
          id,
          leftId,
          rightId,
        });
      });
      dividerBadgeOverlay.add(badgeGroup);

    });

    // A dimension label can select a split group rather than an individual leaf.
    // Draw its selection last and outside the clipped content group so edges that
    // touch the outer frame remain visible on every side.
    if (selectedForRender && selectedForRender !== "root") {
      const selectedSection = findNode(root, selectedForRender);
      if (selectedSection) {
       
        const selectionMargin = 16;
        const selectionX = fx + selectedSection.x * fw + selectionMargin;
        const selectionY = fy + selectedSection.y * fh + selectionMargin;
        const selectionWidth = safeDrawSize(
          selectedSection.w * fw - selectionMargin * 2
        );
        const selectionHeight = safeDrawSize(
          selectedSection.h * fh - selectionMargin * 2
        );
        layer.add(
          new Konva.Rect({
            x: selectionX,
            y: selectionY,
            width: selectionWidth,
            height: selectionHeight,
            stroke: selectedFrameColor,
           
            strokeWidth: 2,
            dash: [8, 5],
            listening: false,
          })
        );
      }
    }

    // Keep join controls above section-selection strokes so M/C stays visible
    // and clickable when either adjoining section is selected.
    layer.add(dividerBadgeOverlay);
    // Section numbers remain visible above panels, dividers and selections.
    layer.add(sectionBadgeOverlay);

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
    const sideTopRatio = rootArchType !== "none" ? getArchTopRatioAtX(root.archType, root.archHeightRatio, 0) : 0;
    const sideTopY = fy + sideTopRatio * fh;
    const effectiveSideHeight = Math.round(heightMm * (1 - sideTopRatio));
    const mainHeightGuideX = hideSelectionForExport
      ? fx - 35
      : fx - horizontalGuideBase - (maxHorizontalLevel >= 0 ? (maxHorizontalLevel + 1) * hierarchyOffset : 26);
    const mainWidthGuideY = hideSelectionForExport
      ? fy + fh + 35
      : fy + fh + verticalGuideBase + (maxVerticalLevel >= 0 ? (maxVerticalLevel + 1) * hierarchyOffset : 26);

    addDimensionLine(layer, mainHeightGuideX, sideTopY, mainHeightGuideX, fy + fh, `${rootArchType !== "none" ? effectiveSideHeight : heightMm} `, hideSelectionForExport);
    addDimensionLine(layer, fx, mainWidthGuideY, fx + fw, mainWidthGuideY, `${widthMm} `, hideSelectionForExport);
    if (!hideSelectionForExport) {

      if (root.split === "vertical" && (root.children?.length ?? 0) >= 2) {
        const y2 = fy + fh + verticalGuideBase;
        root.children!.forEach((c) => addDimensionLine(layer, fx + c.x * fw, y2, fx + (c.x + c.w) * fw, y2, `${Math.round(c.w * widthMm)}`, false));
      }
      if (root.split === "horizontal" && (root.children?.length ?? 0) >= 2) {
        const x2 = fx - horizontalGuideBase;
        root.children!.forEach((c) => addDimensionLine(layer, x2, fy + c.y * fh, x2, fy + (c.y + c.h) * fh, `${Math.round(heightMm * c.h)}`, false));
      }
    }
    const leaves2: SectionNode[] = [];
    mapLeafNodes(root, (leaf) => leaves2.push(leaf));
    const rightMost = [...leaves2].sort((a, b) => (b.x + b.w) - (a.x + a.w) || (b.y + b.h) - (a.y + a.h))[0];
    if (rightMost) addTag(contentGroup, fx + rightMost.x * fw + rightMost.w * fw - 54, fy + rightMost.y * fh + rightMost.h * fh - 54, "F1");
    layer.draw();
    return dividerBadges;
}

// Export at a fixed size, independently of the editor viewport or pan position.
export function generateWindowDoorPreview(item: QuotationItem): string {
  const { root, width, height, meta, baseSystemType } = mapItemToConfiguratorState(item);
  const stageSize = { w: 1200, h: 780 };
  const ratio = Math.min((stageSize.w - 240) / width, (stageSize.h - 240) / height);
  const view = {
    drawW: width * ratio,
    drawH: height * ratio,
    offsetX: (stageSize.w - width * ratio) / 2,
    offsetY: (stageSize.h - height * ratio) / 2,
  };
  const stage = new Konva.Stage({ container: document.createElement("div"), width: stageSize.w, height: stageSize.h });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    const savedFrameColor = item.configuratorLayout?.frameColor;
    renderWindowDoorDesign({
      layer, stageSize, view, root, widthMm: width, heightMm: height, meta, baseSystemType,
      selectedFrameColor: resolveFrameColor(item.colorFinish, typeof savedFrameColor === "string" ? savedFrameColor : undefined),
    });
    return stage.toDataURL({
      x: Math.max(0, view.offsetX - 145),
      y: Math.max(0, view.offsetY - 20),
      width: Math.min(stageSize.w, view.offsetX + view.drawW + 25) - Math.max(0, view.offsetX - 145),
      height: view.drawH + 95,
      pixelRatio: 3,
    });
  } finally {
    stage.destroy();
  }
}
