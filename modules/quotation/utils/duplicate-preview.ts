import type { QuotationItem } from "@/types/quotation";

type LayoutNode = {
  x?: number; y?: number; w?: number; h?: number;
  split?: "horizontal" | "vertical" | null;
  children?: LayoutNode[];
  description?: string;
  sash?: string;
};

const escapeXml = (value: unknown) => String(value ?? "").replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char] || char);
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const openingFromDescription = (description: string, fallback?: string) => {
  const value = description.trim();
  if (/left openable|(?:outward|inward).*(?:\bleft\b|\bl\b)/i.test(value)) return "left";
  if (/right openable|(?:outward|inward).*(?:\bright\b|\br\b)/i.test(value)) return "right";
  if (/top hung/i.test(value)) return "top";
  if (/bottom hung/i.test(value)) return "bottom";
  if (/french|parallel|double/i.test(value)) return "double";
  return fallback || "fixed";
};

const openingGlyph = (type: string, x: number, y: number, w: number, h: number) => {
  const pad = Math.min(w, h) * .12;
  const left = x + pad; const right = x + w - pad;
  const top = y + pad; const bottom = y + h - pad;
  const midX = x + w / 2; const midY = y + h / 2;
  if (type === "left") return `<path class="opening" d="M ${left} ${top} L ${right} ${midY} L ${left} ${bottom}"/><rect class="handle" x="${right - 3}" y="${midY - 16}" width="6" height="32"/>`;
  if (type === "right") return `<path class="opening" d="M ${right} ${top} L ${left} ${midY} L ${right} ${bottom}"/><rect class="handle" x="${left - 3}" y="${midY - 16}" width="6" height="32"/>`;
  if (type === "top") return `<path class="opening" d="M ${left} ${top} L ${midX} ${bottom} L ${right} ${top}"/>`;
  if (type === "bottom") return `<path class="opening" d="M ${left} ${bottom} L ${midX} ${top} L ${right} ${bottom}"/>`;
  if (type === "double") return `<path class="opening" d="M ${left} ${top} L ${midX} ${midY} L ${left} ${bottom} M ${right} ${top} L ${midX} ${midY} L ${right} ${bottom}"/>`;
  return "";
};

export function generateDuplicatePreview(item: QuotationItem): string {
  const widthMm = Math.max(1, finite(item.width, 1));
  const heightMm = Math.max(1, finite(item.height, 1));
  const maxW = 510; const maxH = 350;
  const scale = Math.min(maxW / widthMm, maxH / heightMm);
  const drawW = Math.max(150, widthMm * scale);
  const drawH = Math.max(120, heightMm * scale);
  const originX = 105 + (maxW - drawW) / 2;
  const originY = 80 + (maxH - drawH) / 2;
  const root = (item.configuratorLayout || {}) as LayoutNode;
  const leaves: LayoutNode[] = [];
  const collectLeaves = (node: LayoutNode) => node.children?.length ? node.children.forEach(collectLeaves) : leaves.push(node);
  collectLeaves(root);
  if (!leaves.length) leaves.push({ x: 0, y: 0, w: 1, h: 1, description: item.description, sash: item.sash });
  const sections = leaves.map((leaf, index) => {
    const x = originX + finite(leaf.x, 0) * drawW;
    const y = originY + finite(leaf.y, 0) * drawH;
    const w = Math.max(8, finite(leaf.w, 1) * drawW);
    const h = Math.max(8, finite(leaf.h, 1) * drawH);
    const subItem = item.subItems?.[index];
    const description = subItem?.description || leaf.description || item.description || "";
    const sectionWidth = Math.round(finite(subItem?.width, finite(leaf.w, 1) * widthMm));
    const sectionHeight = Math.round(finite(subItem?.height, finite(leaf.h, 1) * heightMm));
    const opening = openingFromDescription(description, subItem?.sash || leaf.sash || item.sash);
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" class="panel"/><rect x="${x + 7}" y="${y + 7}" width="${Math.max(1, w - 14)}" height="${Math.max(1, h - 14)}" class="glass"/>${openingGlyph(opening, x + 7, y + 7, Math.max(1, w - 14), Math.max(1, h - 14))}<rect x="${x + w / 2 - 48}" y="${y + h - 29}" width="96" height="18" rx="4" class="dim-bg"/><text x="${x + w / 2}" y="${y + h - 16}" class="section-dim">${sectionWidth} × ${sectionHeight} mm</text></g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="520" viewBox="0 0 720 520"><style>.panel{fill:#fff;stroke:#17242b;stroke-width:7}.glass{fill:#e8f5f8;stroke:#68818b;stroke-width:1.5}.section-dim,.dimension,.title{font-family:Arial,sans-serif;text-anchor:middle;fill:#17242b}.section-dim{font-size:10px;fill:#52656e}.dimension{font-size:14px;font-weight:700}.title{font-size:14px;font-weight:700}.guide{stroke:#536970;stroke-width:1.5;fill:none}.opening{stroke:#17242b;stroke-width:2;stroke-dasharray:10 7;fill:none}.handle{fill:#17242b}.dim-bg{fill:#fff;opacity:.86}</style><rect width="720" height="520" fill="#fff"/><text x="360" y="28" class="title">${escapeXml(item.refCode || "Window / Door")} · ${escapeXml(item.systemType || item.productType || "Design")}</text><line x1="${originX}" y1="55" x2="${originX + drawW}" y2="55" class="guide"/><line x1="${originX}" y1="48" x2="${originX}" y2="64" class="guide"/><line x1="${originX + drawW}" y1="48" x2="${originX + drawW}" y2="64" class="guide"/><text x="${originX + drawW / 2}" y="48" class="dimension">${Math.round(widthMm)} mm</text><line x1="72" y1="${originY}" x2="72" y2="${originY + drawH}" class="guide"/><line x1="64" y1="${originY}" x2="80" y2="${originY}" class="guide"/><line x1="64" y1="${originY + drawH}" x2="80" y2="${originY + drawH}" class="guide"/><text x="36" y="${originY + drawH / 2}" class="dimension" transform="rotate(-90 36 ${originY + drawH / 2})">${Math.round(heightMm)} mm</text>${sections}</svg>`;
  return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
}
