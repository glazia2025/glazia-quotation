import type { QuotationItem } from "@/types/quotation";
import {
  generateWindowDoorPreview,
  getEffectiveLeafHeightRatio,
  mapItemToConfiguratorState,
  mapLeafNodes,
  type SectionNode,
} from "@/modules/product-configurator/utils/window-door-design";

const areaSqft = (width: number, height: number) =>
  Number(((width * height) / 92903.04).toFixed(2));

// Keep copied layout geometry and identities in sync with the copied sections.
// In particular, changing dimensions must not leave an old drawing behind.
export function prepareDuplicateDesign(source: QuotationItem, duplicate: QuotationItem): void {
  if (![duplicate.width, duplicate.height].every((size) => Number.isFinite(size) && size > 0)) {
    throw new Error("Window / door width and height must be greater than zero.");
  }
  const { root } = mapItemToConfiguratorState(source);
  const leaves: SectionNode[] = [];
  mapLeafNodes(root, (leaf) => leaves.push(leaf));
  const subItems = duplicate.subItems ?? [];
  const sourceSubItems = source.subItems ?? [];
  const subItemIndex = (leaf: SectionNode) => {
    const matched = sourceSubItems.findIndex((sub) => sub.id === leaf.id || sub._id === leaf.id);
    return matched >= 0 ? matched : leaves.indexOf(leaf);
  };
  const parentChanged = duplicate.width !== source.width || duplicate.height !== source.height;
  const sectionsChanged = subItems.some((sub, index) =>
    sub.width !== sourceSubItems[index]?.width || sub.height !== sourceSubItems[index]?.height
  );

  if (sectionsChanged) {
    // Preserve the split hierarchy. Edited section dimensions determine sibling
    // proportions; all sections still fit inside the overall frame dimensions.
    const requestedSizes = new Map<SectionNode, { w: number; h: number }>();
    const measure = (node: SectionNode): { w: number; h: number } => {
      let size: { w: number; h: number };
      if (!node.children?.length) {
        const index = subItemIndex(node);
        const sub = subItems[index];
        const original = sourceSubItems[index];
        if (sub && ![sub.width, sub.height].every((value) => Number.isFinite(value) && value > 0)) {
          throw new Error("Section width and height must be greater than zero.");
        }
        size = {
          w: sub && sub.width !== original?.width ? sub.width : node.w * duplicate.width,
          h: sub && sub.height !== original?.height
            ? sub.height + (node.h - getEffectiveLeafHeightRatio(root, node)) * duplicate.height
            : node.h * duplicate.height,
        };
      } else {
        const children = node.children.map(measure);
        size = node.split === "vertical"
          ? { w: children.reduce((sum, child) => sum + child.w, 0), h: Math.max(...children.map((child) => child.h)) }
          : { w: Math.max(...children.map((child) => child.w)), h: children.reduce((sum, child) => sum + child.h, 0) };
      }
      requestedSizes.set(node, size);
      return size;
    };
    measure(root);
    const resize = (node: SectionNode) => {
      if (!node.children?.length) return;
      const axis = node.split === "vertical" ? "w" : "h";
      const total = node.children.reduce((sum, child) => sum + requestedSizes.get(child)![axis], 0);
      let cursor = 0;
      node.children.forEach((child, index) => {
        const fraction = index === node.children!.length - 1
          ? 1 - cursor
          : requestedSizes.get(child)![axis] / total;
        child.x = node.x + (axis === "w" ? cursor * node.w : 0);
        child.y = node.y + (axis === "h" ? cursor * node.h : 0);
        child.w = node.w * (axis === "w" ? fraction : 1);
        child.h = node.h * (axis === "h" ? fraction : 1);
        cursor += fraction;
        resize(child);
      });
      node.ratio = requestedSizes.get(node.children[0])![axis] / total;
    };
    resize(root);
  }

  const idMap = new Map<string, string>();
  leaves.forEach((leaf) => {
    const index = subItemIndex(leaf);
    const sub = subItems[index];
    if (!sub) return;
    idMap.set(leaf.id, sub.id);
    if (sourceSubItems[index]?.id) idMap.set(sourceSubItems[index].id, sub.id);
    if (sourceSubItems[index]?._id) idMap.set(sourceSubItems[index]._id!, sub.id);
    if (parentChanged || sectionsChanged) {
      const height = getEffectiveLeafHeightRatio(root, leaf) * duplicate.height;
      sub.width = Math.round(leaf.w * duplicate.width);
      sub.height = Math.round(height);
      sub.area = leaf.systemType === "Blank Area" ? 0 : areaSqft(leaf.w * duplicate.width, height);
      sub.amount = Number((sub.area * sub.rate * sub.quantity).toFixed(2));
    }
  });
  const remapIds = (node: SectionNode) => {
    const previousId = node.id;
    const nextId = node === root ? "root" : idMap.get(previousId) ?? crypto.randomUUID();
    idMap.set(previousId, nextId);
    node.id = nextId;
    node.children?.forEach(remapIds);
  };
  remapIds(root);
  duplicate.joins = duplicate.joins?.map((join) => ({
    ...join,
    p1: idMap.get(join.p1) ?? join.p1,
    p2: idMap.get(join.p2) ?? join.p2,
  }));
  duplicate.configuratorLayout = { ...source.configuratorLayout, ...root };
  if (parentChanged || sectionsChanged) {
    duplicate.area = Number(leaves.reduce((sum, leaf) => sum + (
      leaf.systemType === "Blank Area" ? 0 : areaSqft(leaf.w * duplicate.width, leaf.h * duplicate.height)
    ), 0).toFixed(2));
    duplicate.amount = Number((duplicate.area * duplicate.rate * duplicate.quantity).toFixed(2));
  }
  // An unchanged copy keeps even legacy saved images byte-for-byte identical.
  duplicate.refImage = !parentChanged && !sectionsChanged && source.refImage
    ? source.refImage
    : generateWindowDoorPreview(duplicate);
}
