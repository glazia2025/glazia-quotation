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
  contactPhone?: string;
  globalConfig?: PdfGlobalConfig;
  quotationDetails?: {
    id?: string;
    date?: string;
    opportunity?: string;
    terms?: string;
    notes?: string;
    contactPhone?: string;
  };
  customerDetails?: {
    name?: string;
    company?: string;
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
  return quotation.quoteNo || quotation.quotationNumber || quotation.generatedId || quotation.quotationDetails?.id || quotation.id || "quotation";
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

function getCustomer(quotation: QuotationPdfData) {
  if (quotation.customerDetails) {
    return quotation.customerDetails;
  }

  if (quotation.customer) {
    return {
      name: quotation.customer.customerName,
      company: quotation.customer.projectName,
      email: quotation.customer.email,
      phone: quotation.customer.phone,
      address: quotation.customer.siteAddress,
      city: quotation.customer.city,
      state: quotation.customer.state,
      pincode: quotation.customer.pincode
    };
  }

  return {};
}

function getQuotationDate(quotation: QuotationPdfData) {
  return quotation.quotationDetails?.date || quotation.date || quotation.createdAt || new Date().toISOString();
}

function getQuotationTerms(quotation: QuotationPdfData, globalConfig?: PdfGlobalConfig) {
  return quotation.quotationDetails?.terms || quotation.terms || globalConfig?.terms || "";
}

function getQuotationPrerequisites(globalConfig?: PdfGlobalConfig) {
  return globalConfig?.prerequisites || "";
}

function getContactPhone(quotation: QuotationPdfData, userData: PdfUserData) {
  return quotation.quotationDetails?.contactPhone || quotation.contactPhone || userData.phone || "";
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
    quotationId: quotation.id,
    quoteNo: quotation.quoteNo,
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

function renderMainItemBlock(item: QuotationItem, isCombinationParent: boolean) {
  const showRef = escapeHtml(item.refCode || "-");
  const showSystem = escapeHtml(item.systemType || item.productType || "-");
  const showSeries = escapeHtml(isCombinationParent ? "-" : item.series || "-");
  const showWidth = escapeHtml(item.width || "-");
  const showHeight = escapeHtml(item.height || "-");
  const showArea = escapeHtml(getDisplayArea(item).toFixed(2));
  const showColor = escapeHtml(isCombinationParent ? "-" : item.colorFinish || "-");
  const showLocation = escapeHtml(item.location || item.projectLocation || "-");
  const showDescription = escapeHtml(isCombinationParent ? "-" : item.description || item.productType || "-");
  const showGlass = escapeHtml(isCombinationParent ? "-" : item.glassSpec || item.glassType || "-");
  const showHandleType = escapeHtml(isCombinationParent ? "-" : item.handleType || "-");
  const showHandleColor = escapeHtml(isCombinationParent ? "-" : item.handleColor || "-");
  const showMeshPresent = escapeHtml(isCombinationParent ? "-" : item.meshPresent || "-");
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
                  <td>${escapeHtml(item.width || "-")}</td>
                  <td>${escapeHtml(item.height || "-")}</td>
                  <td>${escapeHtml(area.toFixed(2))}</td>
                  <td>${escapeHtml(item.colorFinish || "-")}</td>
                  <td>${escapeHtml(item.location || "-")}</td>
                  <td>${escapeHtml(item.description || "-")}</td>
                  <td>${escapeHtml(item.glassSpec || "-")}</td>
                  <td>${escapeHtml(item.handleType || "-")}</td>
                  <td>${escapeHtml(item.handleColor || "-")}</td>
                  <td>${escapeHtml(item.meshPresent || "-")}</td>
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
      size: A4 landscape;
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
      width: 277mm;
      min-height: 190mm;
      padding: 0;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .page-content {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6mm;
    }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12mm;
    }

    .brand-block {
      display: flex;
      align-items: center;
      gap: 4mm;
      min-width: 0;
    }

    .user-logo,
    .logo-img {
      width: 18mm;
      height: 18mm;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #6b7280;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .logo-img {
      object-fit: cover;
      background: transparent;
    }

    .brand-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .quotation-label {
      color: #e10e0e;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .contact {
      text-align: right;
      font-size: 11px;
      line-height: 1.5;
    }

    .navy-bar {
      background: #2f3a4f;
      color: #ffffff;
      padding: 4mm;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
    }

    .info-container {
      border: 1px solid #000000;
      padding: 4mm;
      display: flex;
      flex-direction: column;
      gap: 4mm;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 0.9fr;
      gap: 5mm;
    }

    .info-title {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 1.5mm;
    }

    .info-line {
      font-size: 10px;
      line-height: 1.45;
    }

    .meta-card {
      border-left: 1px solid #d8d8d8;
      padding-left: 4mm;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2mm 4mm;
      font-size: 10px;
      align-content: start;
    }

    .meta-value {
      font-weight: 700;
      text-align: right;
    }

    .intro {
      font-weight: 600;
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
      border: 1px solid #000000;
      background: #ffffff;
    }

    .main-row {
      border-bottom: none;
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
      border: 1px solid #e0e0e0;
      padding: 2.2mm;
      vertical-align: middle;
    }

    .window-header .label,
    .computed-values td:first-child,
    .subrow-header td {
      background: #f7f7f7;
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
      min-height: 44mm;
      border-top: 1px solid #e0e0e0;
      border-right: 1px solid #e0e0e0;
      padding: 2mm;
      overflow: hidden;
      text-align: center;
    }

    .window-image img {
      max-width: 100%;
      max-height: 40mm;
      object-fit: contain;
    }

    .computed-values {
      width: 45%;
      border-top: 1px solid #e0e0e0;
    }

    .computed-title {
      background: #f7f7f7;
      font-size: 11px;
      font-weight: 700;
      padding: 2.5mm;
      border-bottom: 1px solid #e0e0e0;
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
      font-size: 8px;
      border-top: 1px dashed #000000;
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
      display: flex;
      justify-content: flex-end;
    }

    .total-card {
      width: 92mm;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      padding: 4mm;
    }

    .total-heading,
    .list-title {
      color: #d5272b;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 3mm;
    }

    .total-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4mm;
      padding: 2.5mm 0;
      border-bottom: 1px solid #eaeaea;
    }

    .total-row:last-child {
      border-bottom: none;
    }

    .lists {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
    }

    .list-card {
      border: 1px solid #d8d8d8;
      padding: 4mm;
      min-height: 36mm;
    }

    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16mm;
      padding-top: 8mm;
    }

    .sig-line {
      border-top: 1px solid #000000;
      padding-top: 2mm;
      text-align: center;
    }
  `;
}

function renderHeaderBlock(params: {
  logoSrc: string;
  userData: PdfUserData;
  contactPhone: string;
  website: string;
  customer: ReturnType<typeof getCustomer>;
  preparedQuotation: QuotationPdfData;
  quotationDate: string;
}) {
  const { logoSrc, userData, contactPhone, website, customer, preparedQuotation, quotationDate } = params;

  return `
    <div class="top-bar avoid-break">
      <div class="brand-block">
        ${logoSrc ? `<img class="logo-img" src="${logoSrc}" alt="Company logo">` : `<div class="user-logo">${escapeHtml(getInitials(userData.name))}</div>`}
        <div class="brand-name">${escapeHtml(userData.name || "Glazia")}</div>
      </div>
      <div class="quotation-label">QUOTATION</div>
      <div class="contact">
        ${contactPhone ? `<div>Phone: ${escapeHtml(contactPhone)}</div>` : ""}
        ${userData.email ? `<div>Email: ${escapeHtml(userData.email)}</div>` : ""}
        ${website ? `<div>Website: ${escapeHtml(website)}</div>` : ""}
      </div>
    </div>

    <div class="navy-bar avoid-break">${escapeHtml(userData.name || "Quotation")}</div>

    <div class="info-container avoid-break">
      <div class="info-grid">
        <div>
          <div class="info-title">To:</div>
          <div class="info-line"><strong>${escapeHtml(customer.name || "-")}</strong></div>
          ${customer.company ? `<div class="info-line">${escapeHtml(customer.company)}</div>` : ""}
          ${customer.address ? `<div class="info-line">${escapeHtml(customer.address)}</div>` : ""}
          <div class="info-line">${escapeHtml([customer.city, customer.state, customer.pincode].filter(Boolean).join(", "))}</div>
          <div class="info-line">Phone: ${escapeHtml(customer.phone || "-")}</div>
          <div class="info-line">Email: ${escapeHtml(customer.email || "-")}</div>
        </div>

        <div>
          <div class="info-title">From:</div>
          <div class="info-line"><strong>${escapeHtml(userData.name || "-")}</strong></div>
          ${userData.completeAddress ? `<div class="info-line">${escapeHtml(userData.completeAddress)}</div>` : ""}
          <div class="info-line">${escapeHtml([userData.city, userData.state, userData.pincode].filter(Boolean).join(", "))}</div>
          <div class="info-line">India</div>
          <div class="info-line">Phone: ${escapeHtml(contactPhone || "-")}</div>
          <div class="info-line">GST: ${escapeHtml(userData.gstNumber || "-")}</div>
        </div>

        <div class="meta-card">
          <div>Quotation no.</div>
          <div class="meta-value">${escapeHtml(getQuotationNumber(preparedQuotation))}</div>
          <div>Date</div>
          <div class="meta-value">${escapeHtml(formatDate(quotationDate))}</div>
          <div>Status</div>
          <div class="meta-value">${escapeHtml(preparedQuotation.status || "Draft")}</div>
        </div>
      </div>

      <div class="intro">We are pleased to submit our quotation of price of products as following :-</div>
    </div>
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
        <div class="list-title">Pre-requisites for Installation of Windows</div>
        <div>${prerequisites ? nl2br(prerequisites) : "N/A"}</div>
      </div>
    </div>

    <div class="signature-row avoid-break">
      <div class="sig-line">Authorized Signatory</div>
      <div class="sig-line">Signature of Customer</div>
    </div>
  `;
}

async function measureHtmlFragmentHeight(styles: string, fragment: string) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "277mm";
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

  const renderedItemSections = pricing.items.map((item) => {
    const isCombinationParent = item.systemType === COMBINATION_SYSTEM && Boolean(item.subItems?.length);

    return `
      <section class="item-group avoid-break">
        ${renderMainItemBlock(item, isCombinationParent)}
        ${isCombinationParent ? renderSubItemsTable(item.subItems || []) : ""}
      </section>
    `;
  });

  console.log("[quotation-pdf] html sections rendered", {
    sectionCount: pricing.items.length
  });
  const styles = buildDocumentStyles();
  const headerBlock = renderHeaderBlock({
    logoSrc,
    userData,
    contactPhone,
    website,
    customer,
    preparedQuotation,
    quotationDate
  });
  const closingBlock = renderClosingBlock({
    pricing,
    quotationTerms,
    prerequisites
  });
  const pageHeightPx = (190 * 96) / 25.4;
  const gapPx = (6 * 96) / 25.4;
  const headerHeight = await measureHtmlFragmentHeight(styles, headerBlock);
  const closingHeight = await measureHtmlFragmentHeight(styles, closingBlock);
  const sectionHeights = await Promise.all(renderedItemSections.map((section) => measureHtmlFragmentHeight(styles, section)));
  console.log("[quotation-pdf] pagination measurements", {
    pageHeightPx,
    headerHeight,
    closingHeight,
    sectionHeights
  });

  const sectionPages: string[][] = [[]];
  let currentPageIndex = 0;
  let currentHeight = headerHeight;

  renderedItemSections.forEach((section, index) => {
    const nextHeight = sectionHeights[index] ?? 0;
    const pageHasContent = sectionPages[currentPageIndex].length > 0;
    const projectedHeight = currentHeight + (pageHasContent ? gapPx : 0) + nextHeight;

    if (projectedHeight > pageHeightPx && pageHasContent) {
      sectionPages.push([]);
      currentPageIndex += 1;
      currentHeight = 0;
    }

    sectionPages[currentPageIndex].push(section);
    currentHeight += (sectionPages[currentPageIndex].length > 1 ? gapPx : 0) + nextHeight;
  });

  let closingPageIndex = sectionPages.length - 1;
  const lastSectionsHeight = sectionPages[closingPageIndex].reduce((sum, _section, index) => {
    const sectionIndex = renderedItemSections.indexOf(sectionPages[closingPageIndex][index]);
    return sum + (index > 0 ? gapPx : 0) + (sectionHeights[sectionIndex] ?? 0);
  }, closingPageIndex === 0 ? headerHeight : 0);
  const projectedClosingHeight = lastSectionsHeight + (sectionPages[closingPageIndex].length > 0 ? gapPx : 0) + closingHeight;

  if (projectedClosingHeight > pageHeightPx) {
    sectionPages.push([]);
    closingPageIndex = sectionPages.length - 1;
  }

  const renderedPages = sectionPages
    .map((sections, index) => {
      const pageParts = [
        index === 0 ? headerBlock : "",
        sections.join(""),
        index === closingPageIndex ? closingBlock : ""
      ].filter(Boolean);

      return `
        <section class="page">
          <div class="page-content">
            ${pageParts.join("")}
          </div>
        </section>
      `;
    })
    .join("");

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
          ${renderedPages}
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
      orientation: "landscape" as const
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
