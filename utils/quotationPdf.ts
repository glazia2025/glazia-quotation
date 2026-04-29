import { getArea } from "@/modules/quotation/utils/calculations";
import type { Quotation, QuotationItem, QuotationSubItem } from "@/types/quotation";
import { createPdfFrame } from "@/utils/pdfFrame";
import { calculateQuotationPricing } from "@/utils/quotationPricing";

type PdfUserData = {
  name?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  completeAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type PdfCustomerData = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type PdfGlobalConfig = {
  logo?: string;
  logoUrl?: string;
  website?: string;
  prerequisites?: string;
  terms?: string;
  additionalCosts?: {
    installation?: number;
    transport?: number;
    loadingUnloading?: number;
    discountPercent?: number;
    showInstallation?: boolean;
    showTransport?: boolean;
    showLoadingUnloading?: boolean;
    showDiscount?: boolean;
  };
};

type QuotationPdfData = Partial<Quotation> & {
  generatedId?: string;
  quotationNumber?: string;
  createdAt?: string;
  globalConfig?: PdfGlobalConfig;
  quotationDetails?: {
    id?: string;
    date?: string;
    opportunity?: string;
    terms?: string;
    notes?: string;
  };
  customerDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items?: QuotationItem[];
  breakdown?: {
    profitPercentage?: number;
  };
  profitPercentage?: number;
};

const COMBINATION_SYSTEM = "Combination";
const defaultPdfGlobalConfig: PdfGlobalConfig = {
  logo: "",
  logoUrl: "",
  website: "",
  prerequisites: "",
  terms: "",
  additionalCosts: {
    installation: 0,
    transport: 0,
    loadingUnloading: 0,
    discountPercent: 0,
    showInstallation: true,
    showTransport: true,
    showLoadingUnloading: true,
    showDiscount: true
  }
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IN");
}

function getQuotationNumber(quotation: QuotationPdfData) {
  return quotation.quotationNumber || quotation.generatedId || quotation.quotationDetails?.id || quotation._id || "quotation";
}

function getQuotationPdfFilename(quotation: QuotationPdfData) {
  return `${getQuotationNumber(quotation)}.pdf`;
}

export function getQuotationPdfDownloadName(quotation: QuotationPdfData) {
  return getQuotationPdfFilename(quotation);
}

function getInitials(name?: string) {
  if (!name) return "??";

  const cleanName = name.replace(/\.in|\.com|\.org|\.net/gi, "").replace(/[^a-zA-Z ]/g, "").trim();
  const parts = cleanName.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return "??";
}

function readStoredUser(): PdfUserData {
  const storedUser = window.localStorage.getItem("glazia-user");
  if (!storedUser) {
    return {};
  }

  try {
    return JSON.parse(storedUser) as PdfUserData;
  } catch {
    return {};
  }
}

function getCustomer(quotation: QuotationPdfData): PdfCustomerData {
  return quotation.customerDetails || {};
}

function getQuotationDate(quotation: QuotationPdfData) {
  return quotation.quotationDetails?.date || quotation.createdAt || new Date().toISOString();
}

function getQuotationTerms(quotation: QuotationPdfData, globalConfig?: PdfGlobalConfig) {
  return quotation.quotationDetails?.terms || globalConfig?.terms || "";
}

function getQuotationPrerequisites(globalConfig?: PdfGlobalConfig) {
  return globalConfig?.prerequisites || "";
}

function getContactPhone(quotation: QuotationPdfData, userData: PdfUserData) {
  return userData.phone || "";
}

function formatMeshPresent(value?: boolean) {
  if (typeof value !== "boolean") {
    return "-";
  }

  return value ? "Yes" : "No";
}

async function imageToBase64(url: string): Promise<string> {
  return new Promise((resolve) => {
    if (!url) {
      console.log("[quotation-pdf] image skipped: empty url");
      resolve("");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;

      if (!ctx) {
        resolve("");
        return;
      }

      ctx.drawImage(img, 0, 0);

      try {
        console.log("[quotation-pdf] image converted", {
          url,
          width: img.width,
          height: img.height
        });
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch {
        console.warn("[quotation-pdf] image conversion failed", { url });
        resolve("");
      }
    };

    img.onerror = () => {
      console.warn("[quotation-pdf] image load failed", { url });
      resolve("");
    };
    img.src = url.startsWith("/") ? `${window.location.origin}${url}` : url;
  });
}

async function prepareQuotationForPdf(quotation: QuotationPdfData): Promise<QuotationPdfData> {
  const globalConfig: PdfGlobalConfig = {
    ...defaultPdfGlobalConfig,
    ...(quotation.globalConfig || {}),
    additionalCosts: {
      ...defaultPdfGlobalConfig.additionalCosts,
      ...(quotation.globalConfig?.additionalCosts || {})
    }
  };
  console.log("[quotation-pdf] prepare start", {
    quotationId: quotation._id ?? quotation.quotationDetails?.id,
    generatedId: quotation.generatedId,
    itemCount: quotation.items?.length ?? 0,
    globalConfig
  });
  const logoSrc = globalConfig.logoUrl || globalConfig.logo || "";
  const preparedLogo = logoSrc ? await imageToBase64(logoSrc) : "";

  const itemsWithImages = await Promise.all(
    (quotation.items || []).map(async (item) => ({
      ...item,
      refImage: item.refImage ? await imageToBase64(item.refImage) : "",
      subItems: item.subItems
        ? await Promise.all(
            item.subItems.map(async (subItem) => ({
              ...subItem,
              refImage: subItem.refImage ? await imageToBase64(subItem.refImage) : ""
            }))
          )
        : undefined
    }))
  );

  console.log("[quotation-pdf] prepare complete", {
    itemCount: itemsWithImages.length,
    withImages: itemsWithImages.filter((item) => Boolean(item.refImage)).length,
    hasPreparedLogo: Boolean(preparedLogo)
  });

  return {
    ...quotation,
    items: itemsWithImages,
    globalConfig: {
      ...globalConfig,
      logo: preparedLogo || globalConfig.logo || "",
      logoUrl: preparedLogo || globalConfig.logoUrl || ""
    }
  };
}

function getDisplayArea(item: Pick<QuotationItem, "area" | "width" | "height">) {
  if (typeof item.area === "number" && Number.isFinite(item.area)) {
    return item.area;
  }

  return getArea(item as QuotationItem);
}

function formatDimensionMm(value: number | string | undefined) {
  return `${value || "-"} mm`;
}

function renderMainItemBlock(item: QuotationItem, isCombinationParent: boolean) {
  const showRef = escapeHtml(item.refCode || "-");
  const showSystem = escapeHtml(item.systemType || item.productType || "-");
  const showSeries = escapeHtml(isCombinationParent ? "-" : item.series || "-");
  const showWidth = escapeHtml(formatDimensionMm(item.width));
  const showHeight = escapeHtml(formatDimensionMm(item.height));
  const showArea = escapeHtml(getDisplayArea(item).toFixed(2));
  const showColor = escapeHtml(isCombinationParent ? "-" : item.colorFinish || "-");
  const showLocation = escapeHtml(item.location || item.projectLocation || "-");
  const showDescription = escapeHtml(isCombinationParent ? "-" : item.description || item.productType || "-");
  const showGlass = escapeHtml(isCombinationParent ? "-" : item.glassSpec || item.glassType || "-");
  const showHandleType = escapeHtml(isCombinationParent ? "-" : item.handleType || "-");
  const showHandleColor = escapeHtml(isCombinationParent ? "-" : item.handleColor || "-");
  const showMeshPresent = escapeHtml(isCombinationParent ? "-" : formatMeshPresent(item.meshPresent));
  const showMeshType = escapeHtml(isCombinationParent ? "-" : item.meshType || "-");
  const showQty = escapeHtml(item.quantity || "-");
  const showAmount = formatCurrency(toNumber(item.amount));
  const showRemarks = escapeHtml(item.remarks || item.specialNotes || "-");
  const imageMarkup = item.refImage ? `<img src="${item.refImage}" alt="Window Image">` : `<span class="no-image">No image</span>`;

  return `
    <div class="window-block main-row avoid-break">
      <table class="window-header">
        <tr>
          <td class="label">Ref-Code</td>
          <td>${showRef}</td>
          <td class="label">Size</td>
          <td>W = ${showWidth}; H = ${showHeight}</td>
          <td class="label">Color</td>
          <td>${showColor}</td>
        </tr>
        <tr>
          <td class="label">Product</td>
          <td>${showSystem}</td>
          <td class="label">Handle</td>
          <td>${showHandleType} - ${showHandleColor}</td>
          <td class="label">Description</td>
          <td>${showDescription}</td>
        </tr>
        <tr>
          <td class="label">Location</td>
          <td>${showLocation}</td>
          <td class="label">Glass</td>
          <td>${showGlass}</td>
          <td class="label">Mesh</td>
          <td>${showMeshPresent} ${showMeshType}</td>
        </tr>
      </table>

      <div class="window-body">
        <div class="window-image">
          ${imageMarkup}
        </div>
        <div class="computed-values">
          <div class="computed-title">Computed Values</div>
          <table>
            <tr>
              <td>Series</td>
              <td colspan="2">${showSeries}</td>
            </tr>
            <tr>
              <td>Area</td>
              <td>${showArea}</td>
              <td>Sq.ft</td>
            </tr>
            <tr>
              <td>Rate per Sq.ft</td>
              <td>${formatCurrency(toNumber(item.rate))}</td>
              <td>INR</td>
            </tr>
            <tr>
              <td>Quantity</td>
              <td>${showQty}</td>
              <td>pcs</td>
            </tr>
            <tr>
              <td>Amount</td>
              <td>${showAmount}</td>
              <td>INR</td>
            </tr>
            <tr>
              <td>Remarks</td>
              <td colspan="2">${showRemarks}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderSubItemsTable(subItems: QuotationSubItem[]) {
  return `
    <div class="window-block sub-row avoid-break">
      <table class="subrow-table">
        <thead>
          <tr class="subrow-header">
            <td rowspan="2">Ref</td>
            <td rowspan="2">Image</td>
            <td rowspan="2">Product</td>
            <td rowspan="2">Series</td>
            <td rowspan="2">Width</td>
            <td rowspan="2">Height</td>
            <td rowspan="2">Area</td>
            <td rowspan="2">Color</td>
            <td rowspan="2">Location</td>
            <td rowspan="2">Description</td>
            <td rowspan="2">Glass</td>
            <td colspan="2">Handle</td>
            <td colspan="2">Mesh</td>
            <td rowspan="2">Rate</td>
            <td rowspan="2">Qty</td>
            <td rowspan="2">Amount</td>
            <td rowspan="2">Remarks</td>
          </tr>
          <tr class="subrow-header">
            <td>Type</td>
            <td>Color</td>
            <td>Present</td>
            <td>Type</td>
          </tr>
        </thead>
        <tbody>
          ${subItems
            .map((item) => {
              const area = typeof item.area === "number" && Number.isFinite(item.area) ? item.area : getDisplayArea(item);

              return `
                <tr class="subrow-data avoid-break">
                  <td>${escapeHtml(item.refCode || "-")}</td>
                  <td>${item.refImage ? `<img src="${item.refImage}" alt="Window image">` : "-"}</td>
                  <td>${escapeHtml(item.systemType || "-")}</td>
                  <td>${escapeHtml(item.series || "-")}</td>
                  <td>${escapeHtml(formatDimensionMm(item.width))}</td>
                  <td>${escapeHtml(formatDimensionMm(item.height))}</td>
                  <td>${escapeHtml(area.toFixed(2))}</td>
                  <td>${escapeHtml(item.colorFinish || "-")}</td>
                  <td>${escapeHtml(item.location || "-")}</td>
                  <td>${escapeHtml(item.description || "-")}</td>
                  <td>${escapeHtml(item.glassSpec || "-")}</td>
                  <td>${escapeHtml(item.handleType || "-")}</td>
                  <td>${escapeHtml(item.handleColor || "-")}</td>
                  <td>${escapeHtml(formatMeshPresent(item.meshPresent))}</td>
                  <td>${escapeHtml(item.meshType || "-")}</td>
                  <td>${formatCurrency(toNumber(item.rate))}</td>
                  <td>${escapeHtml(item.quantity || "-")}</td>
                  <td>${formatCurrency(toNumber(item.amount))}</td>
                  <td>${escapeHtml(item.remarks || "-")}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildDocumentStyles() {
  return `
    @page {
      size: A4 portrait;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      color: #2b2b2b;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .document {
      width: 100%;
    }

    .page {
      position: relative;
      width: 190mm;
      padding: 0;
      padding-bottom: 16mm;
      page-break-after: always;
      break-after: page;
    }

    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .page-content {
      width: 100%;
      display: block;
    }
    
    .page-content > * {
      margin-bottom: 5mm;
    }

    .page-footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      font-size: 9px;
      font-weight: 700;
      color: #111111;
      padding-top: 3mm;
    }

    .page-footer .page-no {
      margin-left: auto;
    }

    .page-footer .powered-by {
      margin-left: 8mm;
    }

    .page-footer.compact .powered-by {
      display: none;
    }

    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10mm;
      padding-top: 3mm;
    }

    .cover-brand {
      display: flex;
      align-items: center;
      min-height: 26mm;
    }

    .logo-img {
      max-width: 48mm;
      max-height: 22mm;
      object-fit: contain;
    }

    .logo-fallback {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.03em;
      color: #d62828;
      text-transform: uppercase;
    }

    .cover-company {
      max-width: 84mm;
      text-align: right;
      font-size: 3.6mm;
      line-height: 1.35;
      font-weight: 700;
      color: #111111;
    }

    .cover-separator {
      border-top: 1mm solid #a79c89;
      margin-top: 8mm;
    }

    .quote-strip {
      padding-top: 4mm;
      text-align: right;
      font-size: 3.9mm;
      line-height: 1.3;
      font-weight: 400;
      color: #111111;
    }

    .quote-strip span {
      white-space: normal;
    }

    .cover-to {
      padding-top: 11mm;
      font-size: 4.2mm;
      font-weight: 700;
      color: #111111;
    }

    .cover-to .recipient-name {
      margin-top: 3.5mm;
      font-size: 4.8mm;
    }

    .cover-letter {
      padding-top: 26mm;
      font-size: 3.95mm;
      line-height: 1.45;
      color: #111111;
    }

    .cover-letter p {
      margin: 0 0 7mm;
    }

    .cover-list {
      margin: -1mm 0 5mm 18mm;
      padding-left: 5mm;
      list-style-type: lower-alpha;
    }

    .cover-list li {
      margin-bottom: 2.5mm;
    }

    .cover-signoff {
      padding-top: 4mm;
      font-size: 3.95mm;
      color: #111111;
    }

    .cover-signoff .company-name {
      font-weight: 700;
    }

    .cover-signature-line {
      margin-top: 18mm;
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8mm;
      padding-bottom: 4mm;
      border-bottom: 0.6mm solid #a79c89;
    }

    .detail-brand {
      display: flex;
      align-items: center;
      gap: 4mm;
      min-width: 0;
    }

    .detail-logo {
      max-width: 38mm;
      max-height: 14mm;
      object-fit: contain;
    }

    .detail-brand-name {
      font-size: 11px;
      font-weight: 700;
      color: #111111;
    }

    .detail-meta {
      font-size: 10px;
      text-align: right;
      line-height: 1.5;
      color: #111111;
    }

    .detail-title {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      margin-top: 1mm;
    }

    .detail-subtitle {
      font-size: 10px;
      color: #4b5563;
    }

    .detail-intro {
      padding: 4mm 0 1mm;
      font-size: 10px;
      color: #374151;
    }

    .item-sheet {
      border: 0.3mm solid #8b8b8b;
      border-radius: 0;
    }

    .item-page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8mm;
      padding-top: 2mm;
      padding-bottom: 2mm;
    }

    .item-page-brand {
      display: flex;
      align-items: center;
      gap: 4mm;
      min-height: 16mm;
    }

    .item-page-logo {
      max-width: 36mm;
      max-height: 14mm;
      object-fit: contain;
    }

    .item-page-company {
      font-size: 4mm;
      font-weight: 700;
      color: #111111;
    }

    .item-page-meta {
      text-align: right;
      font-size: 3.6mm;
      line-height: 1.35;
      color: #111111;
      font-weight: 500;
    }

    .item-page-separator {
      border-top: 0.8mm solid #a79c89;
      margin: 1.5mm 0 4mm;
    }

    .item-meta {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 4.2mm;
    }

    .item-meta td {
      border: 0.3mm solid #8b8b8b;
      padding: 2.4mm 2.8mm;
      vertical-align: middle;
    }

    .item-meta .label {
      width: 18%;
      font-weight: 700;
      background: #dfe5f2;
    }

    .item-meta .value {
      width: 32%;
    }

    .item-body {
      display: flex;
      flex-direction: column;
    }
    
    .item-body-top {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      min-height: 180mm;
    }

    .item-visual {
      border-right: 0.3mm solid #8b8b8b;
      min-height: 180mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8mm 8mm 12mm;
      position: relative;
      overflow: hidden;
      background: #ffffff;
    }

    .item-visual img {
      max-width: 100%;
      max-height: 150mm;
      object-fit: contain;
    }

    .item-visual-caption {
      position: absolute;
      bottom: 8mm;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 4.1mm;
      font-weight: 500;
    }

    .item-spec {
      display: flex;
      flex-direction: column;
    }

    .item-spec-section {
      border-bottom: 0.3mm solid #8b8b8b;
    }

    .item-spec-title {
      background: #cfd8eb;
      font-size: 4.5mm;
      font-weight: 700;
      padding: 2.2mm 2.6mm;
      border-bottom: 0.3mm solid #8b8b8b;
    }

    .item-spec-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 4.1mm;
    }

    .item-spec-table td {
      border-bottom: 0.3mm solid #8b8b8b;
      padding: 2.3mm 2.6mm;
      vertical-align: top;
    }

    .item-spec-table tr:last-child td {
      border-bottom: none;
    }

    .item-spec-table .label {
      width: 48%;
      font-weight: 500;
    }

    .item-spec-table .value {
      width: 52%;
      text-align: left;
      word-break: break-word;
    }

    .terms-page {
      font-size: 4.1mm;
      line-height: 1.5;
      color: #111111;
      padding-top: 2mm;
    }

    .terms-page h2 {
      margin: 0 0 5mm;
      font-size: 6mm;
      line-height: 1.2;
      text-decoration: underline;
    }

    .terms-page ol {
      margin: 0 0 8mm 8mm;
      padding-left: 6mm;
    }

    .terms-page li {
      margin-bottom: 3.2mm;
    }

    .terms-page .acceptance {
      margin-top: 14mm;
    }

    .terms-page .signoff {
      margin-top: 26mm;
    }

    .window-wrapper {
      display: flex;
      flex-direction: column;
      gap: 4mm;
    }

    .item-group,
    .avoid-break,
    .window-block,
    .summary,
    .total-card,
    .lists,
    .list-card,
    .signature-row,
    .subrow-table,
    .subrow-table tr,
    table,
    tr,
    td,
    img {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .item-group {
      display: block;
      width: 100%;
      overflow: hidden;
      page-break-inside: avoid !important;
      break-inside: avoid-page !important;
    }

    .window-block {
      display: block;
      border: 0.35mm solid #d1d5db;
      border-radius: 3mm;
      background: #ffffff;
      overflow: hidden;
    }

    .main-row {
      page-break-inside: avoid !important;
      break-inside: avoid-page !important;
    }

    .window-header,
    .computed-values table,
    .subrow-table {
      width: 100%;
      border-collapse: collapse;
    }

    .window-header td,
    .computed-values td,
    .subrow-table td {
      border: 0.25mm solid #e5e7eb;
      padding: 2.4mm;
      vertical-align: middle;
    }

    .window-header .label,
    .computed-values td:first-child,
    .subrow-header td {
      background: #f8fafc;
      font-weight: 700;
    }

    .window-body {
      display: table;
      width: 100%;
      table-layout: fixed;
    }

    .window-image,
    .computed-values {
      display: table-cell;
      vertical-align: top;
    }

    .window-image {
      min-height: 48mm;
      border-top: 0.25mm solid #e5e7eb;
      border-right: 0.25mm solid #e5e7eb;
      padding: 3mm;
      overflow: hidden;
      text-align: center;
      background: #fbfdff;
    }

    .window-image img {
      max-width: 100%;
      max-height: 44mm;
      object-fit: contain;
    }

    .computed-values {
      width: 48%;
      border-top: 0.25mm solid #e5e7eb;
    }

    .computed-title {
      background: #f8fafc;
      font-size: 10px;
      font-weight: 700;
      padding: 2.5mm;
      border-bottom: 0.25mm solid #e5e7eb;
    }

    .computed-values td:nth-child(2),
    .computed-values td[colspan="2"] {
      text-align: right;
    }

    .sub-row {
      border-top: none;
      page-break-inside: avoid !important;
      break-inside: avoid-page !important;
    }

    .subrow-table {
      table-layout: fixed;
      font-size: 7.4px;
      border-top: 0.25mm dashed #9ca3af;
    }

    .subrow-table img {
      max-height: 14mm;
      max-width: 100%;
      object-fit: contain;
    }

    .no-image {
      color: #94a3b8;
      font-size: 9px;
    }

    .summary {
      display: block;
    }

    .total-card {
      width: 100%;
      border: 0.35mm solid #d1d5db;
      border-radius: 3mm;
      padding: 4mm 5mm;
    }

    .total-heading,
    .list-title {
      color: #111827;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 3mm;
    }

    .total-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4mm;
      padding: 2.5mm 0;
      border-bottom: 0.25mm solid #e5e7eb;
    }

    .total-row:last-child {
      border-bottom: none;
    }

    .lists {
      display: flex;
      flex-direction: column;
      gap: 5mm;
    }

    .list-card {
      border: 0.35mm solid #d1d5db;
      border-radius: 3mm;
      padding: 4mm;
      min-height: 30mm;
    }

    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12mm;
      padding-top: 8mm;
    }

    .sig-line {
      border-top: 0.3mm solid #111111;
      padding-top: 2mm;
      text-align: center;
    }
  `;
}

function renderPageFooter(pageNumber: number, totalPages: number) {
  return `
    <div class="page-footer">
      <div class="page-no">${pageNumber} of ${totalPages}</div>
      <div class="powered-by">powered by Glazia Quotation Software</div>
    </div>
  `;
}

function renderCompactFooter(pageNumber: number, totalPages: number) {
  return `
    <div class="page-footer compact">
      <div class="page-no">${pageNumber} of ${totalPages}</div>
      <div class="powered-by"></div>
    </div>
  `;
}

function renderCoverPage(params: {
  logoSrc: string;
  userData: PdfUserData;
  contactPhone: string;
  website: string;
  customer: ReturnType<typeof getCustomer>;
  preparedQuotation: QuotationPdfData;
  quotationDate: string;
  totalPages: number;
}) {
  const { logoSrc, userData, contactPhone, website, customer, preparedQuotation, quotationDate, totalPages } = params;
  const companyName = userData.name || "Glazia";
  const projectName =
    preparedQuotation.quotationDetails?.opportunity ||
    customer.name ||
    "-";
  const recipientName = customer.name || "Customer";

  return `
    <section class="page">
      <div class="page-content">
        <div class="cover-top avoid-break">
          <div class="cover-brand">
            ${logoSrc ? `<img class="logo-img" src="${logoSrc}" alt="Company logo">` : `<div class="logo-fallback">${escapeHtml(companyName)}</div>`}
          </div>
          <div class="cover-company">
            <div>${escapeHtml(companyName)}</div>
            ${userData.completeAddress ? `<div>${escapeHtml(userData.completeAddress)}</div>` : ""}
            ${[userData.city, userData.state, userData.pincode].filter(Boolean).length ? `<div>${escapeHtml([userData.city, userData.state, userData.pincode].filter(Boolean).join(", "))}</div>` : ""}
            ${contactPhone ? `<div>Contact No. : ${escapeHtml(contactPhone)}</div>` : ""}
            ${userData.email ? `<div>Email : ${escapeHtml(userData.email)}</div>` : ""}
            ${website ? `<div>Website : ${escapeHtml(website)}</div>` : ""}
            ${userData.gstNumber ? `<div>GSTIN : ${escapeHtml(userData.gstNumber)}</div>` : ""}
          </div>
        </div>

        <div class="cover-separator"></div>

        <div class="quote-strip avoid-break">
          <span>Quote No. : ${escapeHtml(getQuotationNumber(preparedQuotation))} / Project : ${escapeHtml(projectName)} / Date : ${escapeHtml(formatDate(quotationDate))}</span>
        </div>

        <div class="cover-to avoid-break">
          <div>To</div>
          <div class="recipient-name">${escapeHtml(recipientName)}</div>
        </div>

        <div class="cover-letter">
          <p>Dear Customer,</p>
          <p>We are delighted that you are considering our range of Windows and Doors for your premises.</p>
          <p>It has gained rapid acceptance across all cities of India for the overwhelming advantages of better protection from noise, heat, rain, dust and pollution.</p>
          <p>In drawing this proposal, it has been our endeavor to suggest designs which would enhance your comfort and aesthetics from inside and improve the facade of the building.</p>
          <p>It has a well-established service network to deliver seamless service at your doorstep. Our offer comprises of the following in enclosure for your kind perusal:</p>
          <ol class="cover-list">
            <li>Window design, specification and value</li>
            <li>Terms and Conditions</li>
          </ol>
          <p>We now look forward to be of service to you.</p>
        </div>

        <div class="cover-signoff avoid-break">
          <div>For <span class="company-name">${escapeHtml(companyName)}</span>,</div>
          <div class="cover-signature-line">Authorized Signatory</div>
        </div>
      </div>
      ${renderPageFooter(1, totalPages)}
    </section>
  `;
}

function renderDetailHeader(params: {
  logoSrc: string;
  userData: PdfUserData;
  preparedQuotation: QuotationPdfData;
  quotationDate: string;
  customer: ReturnType<typeof getCustomer>;
}) {
  const { logoSrc, userData, preparedQuotation, quotationDate, customer } = params;
  const projectName =
    preparedQuotation.quotationDetails?.opportunity ||
    customer.name ||
    "-";

  return `
    <div class="detail-header avoid-break">
      <div class="detail-brand">
        ${logoSrc ? `<img class="detail-logo" src="${logoSrc}" alt="Company logo">` : ""}
        <div class="detail-brand-name">${escapeHtml(userData.name || "Glazia")}</div>
      </div>
      <div class="detail-meta">
        <div><strong>Quote No:</strong> ${escapeHtml(getQuotationNumber(preparedQuotation))}</div>
        <div><strong>Project:</strong> ${escapeHtml(projectName)}</div>
        <div><strong>Date:</strong> ${escapeHtml(formatDate(quotationDate))}</div>
      </div>
    </div>
    <div class="detail-title">Window Design, Specification and Value</div>
    <div class="detail-subtitle">Customer: ${escapeHtml(customer.name || "-")}</div>
    <div class="detail-intro">Below is the proposed specification and commercial value for the selected windows and doors.</div>
  `;
}

function renderClosingBlock(params: {
  pricing: ReturnType<typeof calculateQuotationPricing>;
  quotationTerms: string;
  prerequisites: string;
}) {
  const { pricing, quotationTerms, prerequisites } = params;

  return `
    <div class="summary avoid-break">
      <div class="total-card">
        <div class="total-heading">Quote Total</div>
        <div class="total-row"><span>No. of Components</span><span>${pricing.totalQty}</span></div>
        <div class="total-row"><span>Total Area (sqft)</span><span>${pricing.totalArea.toFixed(2)}</span></div>
        <div class="total-row"><span><strong>Basic Value</strong></span><span><strong>${formatCurrency(pricing.baseTotal)}</strong></span></div>
        <div class="total-row"><span>Profit</span><span>${formatCurrency(pricing.profitValue)}</span></div>
        <div class="total-row"><span>Installation</span><span>${formatCurrency(pricing.installationCost)}</span></div>
        <div class="total-row"><span>Transport</span><span>${formatCurrency(pricing.transportCost)}</span></div>
        <div class="total-row"><span>Loading & Unloading</span><span>${formatCurrency(pricing.loadingUnloadingCost)}</span></div>
        <div class="total-row"><span>Discount</span><span>${formatCurrency(pricing.discountValue)}</span></div>
        <div class="total-row"><span>Total Project Cost</span><span>${formatCurrency(pricing.totalProjectCost)}</span></div>
        <div class="total-row"><span>GST 18%</span><span>${formatCurrency(pricing.gstValue)}</span></div>
        <div class="total-row"><span><strong>Grand Total</strong></span><span><strong>${formatCurrency(pricing.grandTotal)}</strong></span></div>
        <div class="total-row"><span>Avg. Price Per Sq. Ft. Without GST</span><span>${formatCurrency(pricing.avgWithoutGst)}</span></div>
        <div class="total-row"><span>Avg. Price Per Sq. Ft.</span><span>${formatCurrency(pricing.avgWithGst)}</span></div>
      </div>
    </div>

    <div class="lists">
      <div class="list-card avoid-break">
        <div class="list-title">Terms & Conditions</div>
        <div>${quotationTerms ? nl2br(quotationTerms) : "N/A"}</div>
      </div>
      <div class="list-card avoid-break">
        <div class="list-title">Pre-requisites for Installation</div>
        <div>${prerequisites ? nl2br(prerequisites) : "N/A"}</div>
      </div>
    </div>

    <div class="signature-row avoid-break">
      <div class="sig-line">Authorized Signatory</div>
      <div class="sig-line">Signature of Customer</div>
    </div>
  `;
}

function renderItemPage(
  item: ReturnType<typeof calculateQuotationPricing>["items"][number],
  pageNumber: number,
  totalPages: number,
  quoteNo: string,
  companyName: string
) {
  const itemName = item.description || item.systemType || item.productType || "-";
  const imageMarkup = item.refImage ? `<img src="${item.refImage}" alt="${escapeHtml(itemName)}">` : `<span class="no-image">No image</span>`;
  const meshLabel = `${formatMeshPresent(item.meshPresent)}${item.meshType ? ` / ${item.meshType}` : ""}`;
  const remarks = item.remarks || item.specialNotes || "-";
  const rightRows = [
    ["Size", `${formatDimensionMm(item.width)} x ${formatDimensionMm(item.height)}`],
    ["System", item.systemType || item.productType || "-"],
    ["Series", item.series || "-"],
    ["Glass", item.glassSpec || item.glassType || "-"],
    ["Handle", [item.handleType, item.handleColor].filter(Boolean).join(" / ") || "-"],
    ["Mesh", meshLabel],
    ["Sq.Ft. per Unit", item.area.toFixed(2)],
    ["Value per Sq.Ft.", formatCurrency(toNumber(item.rate))],
    ["Unit Price", formatCurrency(toNumber(item.amount) / Math.max(1, toNumber(item.quantity) || 1))],
    ["Quantity", String(item.quantity || 1)],
    ["Value", formatCurrency(toNumber(item.amount))],
    ["Remarks", remarks]
  ];

  const subItemsMarkup =
    item.subItems && item.subItems.length > 0
      ? `
        <div class="item-spec-section" style="border-top: 0.3mm solid #8b8b8b;">
          <div class="item-spec-title">Sections</div>
          ${renderSubItemsTable(item.subItems)}
        </div>
      `
      : "";
  return `
    <section class="page">
      <div class="page-content">
        <div class="item-page-header avoid-break">
          <div class="item-page-brand">
            <div class="item-page-company">${escapeHtml(companyName)}</div>
          </div>
          <div class="item-page-meta">
            <div><strong>Quote No.</strong> : ${escapeHtml(quoteNo)}</div>
            <div><strong>Ref-Code</strong> : ${escapeHtml(item.refCode || "-")}</div>
            <div><strong>Location</strong> : ${escapeHtml(item.location || item.projectLocation || "-")}</div>
          </div>
        </div>
        <div class="item-page-separator"></div>
        <div class="item-sheet">
          <table class="item-meta avoid-break">
            <tr>
              <td class="label">Code :</td>
              <td class="value">${escapeHtml(item.refCode || "-")}</td>
              <td class="label">Size :</td>
              <td class="value">${escapeHtml(formatDimensionMm(item.width))} x ${escapeHtml(formatDimensionMm(item.height))}</td>
            </tr>
            <tr>
              <td class="label">Name :</td>
              <td class="value">${escapeHtml(itemName)}</td>
              <td class="label">Profile Series :</td>
              <td class="value">${escapeHtml(item.series || item.systemType || "-")}</td>
            </tr>
            <tr>
              <td class="label">Location :</td>
              <td class="value">${escapeHtml(item.location || item.projectLocation || "-")}</td>
              <td class="label">Glass :</td>
              <td class="value">${escapeHtml(item.glassSpec || item.glassType || "-")}</td>
            </tr>
          </table>

            <div class="item-body-top avoid-break">
              <div class="item-visual">
                ${imageMarkup}
                <div class="item-visual-caption">View From Inside</div>
              </div>
              <div class="item-spec">
                <div class="item-spec-section" style="border-bottom: none;">
                  <div class="item-spec-title">Computed Values</div>
                  <table class="item-spec-table">
                    ${rightRows
                      .map(
                        ([label, value]) => `
                          <tr>
                            <td class="label">${escapeHtml(label)}</td>
                            <td class="value">${escapeHtml(value)}</td>
                          </tr>
                        `
                      )
                      .join("")}
                  </table>
                </div>
              </div>
            </div>
            ${subItemsMarkup}
          </div>
        </div>
      </div>
      ${renderCompactFooter(pageNumber, totalPages)}
    </section>
  `;
}

function renderTermsPage(params: {
  quotationTerms: string;
  prerequisites: string;
  pageNumber: number;
  totalPages: number;
}) {
  const { quotationTerms, prerequisites, pageNumber, totalPages } = params;
  const termItems = quotationTerms
    ? quotationTerms
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : ["Prices are valid for 30 days from the date of quotation."];
  const prerequisiteItems = prerequisites
    ? prerequisites
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : ["All apertures should be ready and accessible before installation."];

  return `
    <section class="page">
      <div class="page-content terms-page">
        <h2>Terms & Conditions:-</h2>
        <ol>
          ${termItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>

        <h2>Pre-Requisites for Installation of Windows:-</h2>
        <ol>
          ${prerequisiteItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>

        <div class="acceptance">I hereby accept the estimate as per above mentioned price and specifications.</div>
        <div class="signoff">Authorized Signatory</div>
      </div>
      ${renderCompactFooter(pageNumber, totalPages)}
    </section>
  `;
}

async function measureHtmlFragmentHeight(styles: string, fragment: string) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "190mm";
  host.style.visibility = "hidden";
  host.innerHTML = `<style>${styles}</style><div class="page"><div class="page-content">${fragment}</div></div>`;
  document.body.appendChild(host);

  await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
  const measured = host.querySelector(".page-content") as HTMLElement | null;
  const height = measured ? measured.getBoundingClientRect().height : 0;
  host.remove();
  return height;
}

async function createQuotationHtml(quotation: QuotationPdfData) {
  const userData = readStoredUser();
  const preparedQuotation = await prepareQuotationForPdf(quotation);
  const globalConfig = preparedQuotation.globalConfig || {};
  const contactPhone = getContactPhone(preparedQuotation, userData);
  const customer = getCustomer(preparedQuotation);
  const quotationDate = getQuotationDate(preparedQuotation);
  const quotationTerms = getQuotationTerms(preparedQuotation, globalConfig);
  const prerequisites = getQuotationPrerequisites(globalConfig);
  const website = globalConfig.website || "";
  const logoSrc = globalConfig.logoUrl || globalConfig.logo || "";
  const pricing = calculateQuotationPricing(
    preparedQuotation.items || [],
    globalConfig.additionalCosts,
    preparedQuotation.breakdown?.profitPercentage ?? preparedQuotation.profitPercentage ?? 0
  );
  console.log("[quotation-pdf] html data ready", {
    quotationNumber: getQuotationNumber(preparedQuotation),
    customer: getCustomer(preparedQuotation),
    contactPhone,
    pricing
  });

  const styles = buildDocumentStyles();
  const totalPages = 1 + pricing.items.length + 1;
  const coverPage = renderCoverPage({
    logoSrc,
    userData,
    contactPhone,
    website,
    customer,
    preparedQuotation,
    quotationDate,
    totalPages
  });
  const quoteNo = getQuotationNumber(preparedQuotation);
  const companyName = userData.name || "Glazia";
  const detailPages = pricing.items.map((item, index) => renderItemPage(item, index + 2, totalPages, quoteNo, companyName)).join("");
  const termsPage = renderTermsPage({
    quotationTerms,
    prerequisites,
    pageNumber: totalPages,
    totalPages
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Quotation ${escapeHtml(getQuotationNumber(preparedQuotation))}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="document">
          ${coverPage}
          ${detailPages}
          ${termsPage}
        </div>
      </body>
    </html>
  `;
}

function getQuotationPdfOptions(quotation: QuotationPdfData, doc: Document) {
  return {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: getQuotationPdfFilename(quotation),
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc: Document) => {
        if (doc.head && clonedDoc.head) {
          clonedDoc.head.innerHTML = "";
          clonedDoc.head.appendChild(doc.head.cloneNode(true));
        }
      }
    },
    jsPDF: {
      unit: "mm" as const,
      format: "a4" as const,
      orientation: "portrait" as const
    },
    pagebreak: {
      mode: ["avoid-all", "css", "legacy"] as Array<"css" | "legacy" | "avoid-all">,
      avoid: [".avoid-break", ".item-group", ".window-block", ".summary", ".list-card", ".signature-row", "tr", "img"]
    }
  };
}

export async function generateQuotationPDFBlob(quotation: QuotationPdfData) {
  const html2pdf = (await import("html2pdf.js")).default;
  console.log("[quotation-pdf] blob generation start");
  const html = await createQuotationHtml(quotation);
  console.log("[quotation-pdf] blob html string created", { length: html.length });
  const { body, cleanup, doc } = await createPdfFrame(html);
  console.log("[quotation-pdf] blob pdf frame created", {
    bodyChildCount: body.children.length
  });

  try {
    const worker = html2pdf().set(getQuotationPdfOptions(quotation, doc)).from(body);
    console.log("[quotation-pdf] worker created for blob");
    await worker.toPdf();
    console.log("[quotation-pdf] worker toPdf complete");
    return await worker.output("blob");
  } finally {
    console.log("[quotation-pdf] blob cleanup");
    cleanup();
  }
}

export async function generateQuotationPDF(quotation: QuotationPdfData) {
  console.log(quotation);
  const html2pdf = (await import("html2pdf.js")).default;
  console.log("[quotation-pdf] save generation start");
  const html = await createQuotationHtml(quotation);
  console.log("[quotation-pdf] html string created", { length: html.length });
  const { body, cleanup, doc } = await createPdfFrame(html);
  console.log("[quotation-pdf] pdf frame created", {
    bodyChildCount: body.children.length
  });

  try {
    const options = getQuotationPdfOptions(quotation, doc);
    console.log("[quotation-pdf] save options", options);
    await html2pdf().set(getQuotationPdfOptions(quotation, doc)).from(body).save();
    console.log("[quotation-pdf] save complete");
  } catch (error) {
    console.error("[quotation-pdf] save failed", error);
    throw error;
  } finally {
    console.log("[quotation-pdf] save cleanup");
    cleanup();
  }
}
