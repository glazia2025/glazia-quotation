"use client";

import Link from "next/link";
import { useMemo, useState,useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Download,
  FileClock,
  Plus,
  RotateCcw,
  Send,
  Share2,
  Trash2,
  WandSparkles,
  XCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/components/shared/page-shell";
import { useRbac } from "@/hooks/use-rbac";
import { accessoryCatalog, finishes, getDesigns, getOpenings, getSeries, glassTypes, materials } from "@/modules/quotation/data/catalog";
import { useQuotationBuilder } from "@/modules/quotation/hooks/use-quotation-builder";
import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";
import { toEditorQuotation } from "@/modules/quotation/utils/backend-quotation";
import { calculateQuotationTotals, getArea, getItemGrandTotal, getPerimeter } from "@/modules/quotation/utils/calculations";
import { saveQuotationDraft } from "@/services/quotation-service";
import type { Quotation, QuotationItem } from "@/types/quotation";
import { formatCurrency, formatNumber } from "@/utils/format";
import { generateQuotationPDFBlob, getQuotationPdfDownloadName } from "@/utils/quotationPdf";
import { useRouter } from "next/navigation";
import { loadGlobalConfig } from "../../../utils/globalConfig";


const customerSchema = z.object({
  customerName: z.string().min(2),
  contactPerson: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email(),
  projectName: z.string().min(2),
  siteAddress: z.string().min(3)
});

type TabKey = "customer" | "quotation" | "global"|"item";

const tabs: { key: TabKey; label: string }[] = [
  { key: "customer", label: "Customer Details" },
  { key: "quotation", label: "Quotation Details" },
  { key: "global", label: "Global Config" },
  { key: "item", label: "Item List" },
 
  
];
function ItemCard({ item, configuratorBasePath }: { item: QuotationItem; configuratorBasePath: string }) {
  const [showSections, setShowSections] = useState(false);
  const removeItem = useQuotationBuilderStore((state) => state.removeItem);
  const itemCount = useQuotationBuilderStore((state) => state.quotation.items.length);
  const systemLabel = item.systemType || item.series || item.openingType || "Not configured";
  const locationLabel = item.location || item.projectLocation || "Not specified";
  const refCodeLabel = item.refCode || (item.id ? item.id.slice(0, 8).toUpperCase() : "Item");
  const hasSections = (item.subItems?.length ?? 0) > 1 || item.systemType === "Combination";
  const canDelete = itemCount > 1;

  const handleDelete = () => {
    if (!canDelete) return;
    removeItem(item.id);
  };

  return (
    <>
    <div className="self-start space-y-2 rounded-2xl border bg-white p-3 shadow-sm transition hover:shadow-md">
      <div className="flex h-60 items-center justify-center overflow-hidden rounded-xl border bg-white p-1">
        {item.refImage ? (
          <img src={item.refImage} alt={item.refCode || item.productType || "Quotation item"} className="h-full w-full object-contain" />
        ) : (
          <div className="w-full max-w-[150px] rounded-md border-[8px] border-slate-800 bg-white shadow-sm">
            <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${Math.max(1, item.previewPanels || 1)}, minmax(0, 1fr))` }}>
              {Array.from({ length: Math.max(1, item.previewPanels || 1) }).map((_, index) => (
                <div key={index} className="border-l border-slate-300 first:border-l-0">
                  <div className="h-full bg-[linear-gradient(135deg,rgba(125,211,252,0.35),rgba(191,219,254,0.75))]" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Ref Code</span>
        <span className="font-semibold">{refCodeLabel}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Location</span>
        <span className="text-right font-medium">{locationLabel}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">System</span>
        <span className="font-medium">{systemLabel}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Size</span>
        <span className="font-medium">{item.width}" x {item.height}"</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        <Button size="sm" asChild className="bg-[#124657] hover:bg-[#0b3642]">
          <Link href={`${configuratorBasePath}/${item.id}`}>Edit</Link>
        </Button>
        {hasSections ? (
          <Button size="sm" variant="outline" onClick={() => setShowSections(true)}>
            Show Sections
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={handleDelete} disabled={!canDelete} className="text-red-600 hover:text-red-700">
          Delete
        </Button>
      </div>
    </div>
    {showSections ? (
      <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/60 p-4">
        <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Sections</h3>
              <p className="text-sm text-slate-500">{refCodeLabel} | {locationLabel}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowSections(false)}>
              Close
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-auto p-6">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Ref Code</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">System</th>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium">Area</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {(item.subItems ?? []).map((section) => (
                  <tr key={section.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3 font-medium text-slate-900">{section.refCode}</td>
                    <td className="px-3 py-3 text-slate-600">{section.location}</td>
                    <td className="px-3 py-3 text-slate-600">{section.systemType}</td>
                    <td className="px-3 py-3 text-slate-600">{section.width}" x {section.height}"</td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(section.area)}</td>
                    <td className="px-3 py-3 text-slate-600">{section.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function QuotationPreview({ item }: { item: QuotationItem | undefined }) {
  if (!item) return null;

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="mb-4 text-sm font-medium text-slate-600">2D preview</div>
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] p-4">
        <div className="relative h-44 w-full max-w-[340px] rounded-md border-[10px] border-slate-800 bg-white shadow-lg">
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${item.previewPanels}, minmax(0, 1fr))` }}>
            {Array.from({ length: item.previewPanels }).map((_, index) => (
              <div key={index} className="border-l border-slate-300 first:border-l-0">
                <div className="h-full bg-[linear-gradient(135deg,rgba(125,211,252,0.35),rgba(191,219,254,0.75))]" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-600">
        <div className="rounded-xl bg-white p-3">Area: {formatNumber(getArea(item))} sq.ft</div>
        <div className="rounded-xl bg-white p-3">Perimeter: {formatNumber(getPerimeter(item))} rft</div>
        <div className="rounded-xl bg-white p-3">Panels: {item.previewPanels}</div>
      </div>
    </div>
  );
}
// const handleSave = async () => {
//   const payload = {
//     quotationDetails: quotation,
//     customerDetails: quotation.customer,
//     items: quotation.items,
//     globalConfig: globalConfig,
//   };

//   try {
//     await axios.post(
//       `${API_BASE_URL}/api/quotations`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("authToken")}`,
//         },
//       }
//     );

//     alert("Saved successfully ");
//   } catch (err) {
//     console.error(err);
//     alert("Error saving ");
//   }
// };
function ItemTab({ quotationBasePath }: { quotationBasePath: string }) {
  const items = useQuotationBuilderStore((state) => state.quotation.items);
  const addItem = useQuotationBuilderStore((state) => state.addItem);
  const router = useRouter();
  const [profit, setProfit] = useState(0);
  const configuratorBasePath = `${quotationBasePath}/configurator`;

  const totalQuantity = items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
  const totalArea = items.reduce((sum, item) => sum + getArea(item) * Math.max(1, item.quantity || 1), 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const finalAmount = totalAmount + (totalAmount * profit) / 100;
  const finalWithGST = finalAmount + (finalAmount * 18) / 100;

  const handleAddItem = () => {
    const newItemId = addItem();
    router.push(`${configuratorBasePath}/${newItemId}`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-slate-950 px-5 py-4 text-white">
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-[180px]">
            <h2 className="text-lg font-semibold">Configured Items</h2>
            <p className="text-sm text-slate-300">{items.length} item{items.length === 1 ? "" : "s"} in this quotation</p>
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Quantity</div>
              <div className="mt-1 text-xl font-bold">{totalQuantity}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Area</div>
              <div className="mt-1 text-xl font-bold">{formatNumber(totalArea)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Amount</div>
              <div className="mt-1 text-xl font-bold">{formatCurrency(totalAmount)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Profit %</div>
              <input
                type="number"
                value={profit}
                onChange={(e) => setProfit(Number(e.target.value))}
                className="mt-1 w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Final</div>
              <div className="mt-1 text-xl font-bold">{formatCurrency(finalAmount)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Final + GST</div>
              <div className="mt-1 text-xl font-bold">{formatCurrency(finalWithGST)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <ItemCard
            key={item.id || item.refCode || `${item.location || item.projectLocation || "item"}-${index}`}
            item={item}
            configuratorBasePath={configuratorBasePath}
          />
        ))}
        <button
          type="button"
          onClick={handleAddItem}
          className="flex min-h-[260px] flex-col items-center justify-center self-start rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition hover:border-[#124657] hover:bg-slate-50"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#124657] text-white">
            <Plus className="h-7 w-7" />
          </div>
          <div className="mt-4 text-lg font-semibold text-slate-900">Add Item</div>
          <div className="mt-2 max-w-[220px] text-sm text-slate-500">Open the window configurator and add the next quotation item.</div>
        </button>
      </div>
    </div>
  );
}
function CustomerTab() {
  const customer = useQuotationBuilderStore((state) => state.quotation.customer);
  const updateCustomer = useQuotationBuilderStore((state) => state.updateCustomer);
  const customerValues = customer ?? {
    customerName: "",
    contactPerson: "",
    phone: "",
    email: "",
    projectName: "",
    siteAddress: "",
    city: "",
    state: "",
    pincode: ""
  };

  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black-200 p-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-6 flex w-full items-center justify-between text-left"
      >
        <h2 className="text-xl font-bold text-gray-900">Customer Details</h2>
        {expanded ? (
          <span>▲</span>
        ) : (
          <span>▼</span>
        )}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Customer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name
            </label>
            <input
              type="text"
              value={customerValues.customerName}
              onChange={(e) =>
                updateCustomer("customerName", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={customerValues.email}
              onChange={(e) =>
                updateCustomer("email", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={customerValues.phone}
              onChange={(e) =>
                updateCustomer("phone", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <textarea
              value={customerValues.siteAddress}
              onChange={(e) =>
                updateCustomer("siteAddress", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <input
              type="text"
              value={customerValues.city || ""}
              onChange={(e) =>
                updateCustomer("city", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State
            </label>
            <input
              type="text"
              value={customerValues.state || ""}
              onChange={(e) =>
                updateCustomer("state", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN Code
            </label>
            <input
              type="text"
              value={customerValues.pincode || ""}
              onChange={(e) =>
                updateCustomer("pincode", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

        </div>
      )}
    </div>
  );
}
function GlobalConfigTab({  globalConfig,
  setGlobalConfig,
  logoPreview,
  handleLogoUpload
}: any) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black-200 p-6">

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-6 flex w-full items-center justify-between text-left"
      >
        <h2 className="text-xl font-bold text-gray-900">Global Config</h2>
        {expanded ? <span>▲</span> : <span>▼</span>}
      </button>

      {expanded && (
        <>
          <div className="mb-6 flex justify-end">
            <a href="/quotations/settings" className="text-sm text-[#124657]">
              Manage
            </a>
          </div>

          {/* LOGO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <label className="block text-sm mb-2">Logo</label>

              {logoPreview && (
                <div className="mb-4 flex gap-4">
                  <img src={logoPreview} className="h-16 border p-2" />
                  <button
                    onClick={() =>
                      setGlobalConfig((p:any) => ({ ...p, logo: "", logoUrl: "" }))
                    }
                    className="text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}

              <input
                type="file"
                onChange={(e) =>
                  handleLogoUpload(e.target.files?.[0] || null)
                }
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Prerequisites</label>
              <textarea
                value={globalConfig.prerequisites}
                onChange={(e) =>
                  setGlobalConfig((p:any) => ({
                    ...p,
                    prerequisites: e.target.value,
                  }))
                }
                 rows={3}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg  focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Website</label>
              <input
                value={globalConfig.website}
                onChange={(e) =>
                  setGlobalConfig((p:any) => ({
                    ...p,
                    website: e.target.value,
                  }))
                }
                 
  className="w-full px-4 py-2 border border-gray-300 rounded-lg  focus:border-transparent"
              />
            </div>
          </div>


          {/* TERMS */}
          <div className="mt-6">
            <label>Terms</label>
            <textarea
              value={globalConfig.terms}
              onChange={(e) =>
                setGlobalConfig((p:any) => ({
                  ...p,
                  terms: e.target.value,
                }))
              }
               rows={3}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg  focus:border-transparent"
            />
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">

  {/* INSTALLATION */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Installation (₹/sqft)
    </label>

    <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
      <input
        type="checkbox"
        checked={globalConfig.additionalCosts.showInstallation ?? true}
        onChange={(e) =>
          setGlobalConfig((p: any) => ({
            ...p,
            additionalCosts: {
              ...p.additionalCosts,
              showInstallation: e.target.checked,
            },
          }))
        }
      />
      <span>Show in PDF</span>
    </label>

    <input
      type="number"
      value={globalConfig.additionalCosts.installation}
      onChange={(e) =>
        setGlobalConfig((p: any) => ({
          ...p,
          additionalCosts: {
            ...p.additionalCosts,
            installation: Number(e.target.value) || 0,
          },
        }))
      }
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
    />
  </div>

  {/* TRANSPORT */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Transport (₹)
    </label>

    <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
      <input
        type="checkbox"
        checked={globalConfig.additionalCosts.showTransport ?? true}
        onChange={(e) =>
          setGlobalConfig((p: any) => ({
            ...p,
            additionalCosts: {
              ...p.additionalCosts,
              showTransport: e.target.checked,
            },
          }))
        }
      />
      <span>Show in PDF</span>
    </label>

    <input
      type="number"
      value={globalConfig.additionalCosts.transport}
      onChange={(e) =>
        setGlobalConfig((p: any) => ({
          ...p,
          additionalCosts: {
            ...p.additionalCosts,
            transport: Number(e.target.value) || 0,
          },
        }))
      }
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
    />
  </div>

  {/* LOADING */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Loading & Unloading (₹)
    </label>

    <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
      <input
        type="checkbox"
        checked={globalConfig.additionalCosts.showLoadingUnloading ?? true}
        onChange={(e) =>
          setGlobalConfig((p: any) => ({
            ...p,
            additionalCosts: {
              ...p.additionalCosts,
              showLoadingUnloading: e.target.checked,
            },
          }))
        }
      />
      <span>Show in PDF</span>
    </label>

    <input
      type="number"
      value={globalConfig.additionalCosts.loadingUnloading}
      onChange={(e) =>
        setGlobalConfig((p: any) => ({
          ...p,
          additionalCosts: {
            ...p.additionalCosts,
            loadingUnloading: Number(e.target.value) || 0,
          },
        }))
      }
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
    />
  </div>

  {/* DISCOUNT */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Discount (%)
    </label>

    <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
      <input
        type="checkbox"
        checked={globalConfig.additionalCosts.showDiscount ?? true}
        onChange={(e) =>
          setGlobalConfig((p: any) => ({
            ...p,
            additionalCosts: {
              ...p.additionalCosts,
              showDiscount: e.target.checked,
            },
          }))
        }
      />
      <span>Show in PDF</span>
    </label>

    <input
      type="number"
      value={globalConfig.additionalCosts.discountPercent}
      onChange={(e) =>
        setGlobalConfig((p: any) => ({
          ...p,
          additionalCosts: {
            ...p.additionalCosts,
            discountPercent: Number(e.target.value) || 0,
          },
        }))
      }
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
    />
  </div>

</div>

        </>
      )}
    </div>
  );
}
function QuotationDetailsTab() {
  const quotation = useQuotationBuilderStore((s) => s.quotation);
  const updateQuotationField = useQuotationBuilderStore((s) => s.updateQuotationField);

  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black-200 p-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-6 flex w-full items-center justify-between text-left"
      >
        <h2 className="text-xl font-bold text-gray-900">Quotation Details</h2>
        {expanded ? <span>▲</span> : <span>▼</span>}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={quotation.date || ""}
              onChange={(e) =>
                updateQuotationField("date", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Opportunity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opportunity Stage
            </label>
            <select
              value={quotation.opportunity || "Enquiry"}
              onChange={(e) =>
                updateQuotationField("opportunity", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-200 rounded"
            >
              <option value="Enquiry">Enquiry</option>
              <option value="Quoted">Quoted</option>
              <option value="Under Negotiation">Under Negotiation</option>
              <option value="Order Confirmed">Order Confirmed</option>
              <option value="Order Lost">Order Lost</option>
            </select>
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Phone (for PDF)
            </label>
            <input
              type="tel"
              value={quotation.contactPhone || ""}
              onChange={(e) =>
                updateQuotationField("contactPhone", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

        </div>
      )}
    </div>
  );
}


export function QuotationBuilder({
  initialQuotation,
  quotationBasePath = "/quotations/new"
}: {
  initialQuotation?: Quotation;
  quotationBasePath?: string;
}) {
  const currentQuotationId = useQuotationBuilderStore((state) => state.quotation.id);
  const setQuotation = useQuotationBuilderStore((state) => state.setQuotation);

 useEffect(() => {
  const fetchData = async () => {
    const data = await loadGlobalConfig();
    if (data) {
      setGlobalConfig(data);
    }
  };

  fetchData();
}, []);
 useEffect(() => {
  if (!initialQuotation) return;
  if (currentQuotationId === initialQuotation.id) return;
  setQuotation(initialQuotation);
 }, [currentQuotationId, initialQuotation, setQuotation]);
  const [activeTab, setActiveTab] = useState<TabKey>("customer");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [globalConfig, setGlobalConfig] = useState({
  logo: "",
  logoUrl: "",
  prerequisites: "",
  website: "",
  terms: "",
  additionalCosts: {
    installation: 0,
    transport: 0,
    loadingUnloading: 0,
    discountPercent: 0,
    showInstallation: true,
    showTransport: true,
    showLoadingUnloading: true,
    showDiscount: true,
  },
});
useEffect(() => {
  return () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
  };
}, [pdfPreviewUrl]);
const handleSave = async () => {
  try {
    const savedQuotation = await saveQuotationDraft(quotation);
    if (savedQuotation) {
      setQuotation(toEditorQuotation(savedQuotation));
    }
    markSaved();
    alert("Saved successfully ");
  } catch (err) {
    console.error(err);
    alert("Error saving ");
  }
};

  const { quotation, saveState } = useQuotationBuilder();
  const { can } = useRbac();
  const markSaved = useQuotationBuilderStore((state) => state.markSaved);
  const setStatus = useQuotationBuilderStore((state) => state.setStatus);
  const logoPreview = globalConfig.logoUrl || globalConfig.logo;
const handleLogoUpload = (file: File | null) => {
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    setGlobalConfig((prev) => ({
      ...prev,
      logo: reader.result as string,
      logoUrl: reader.result as string,
    }));
  };
  reader.readAsDataURL(file);
};
  const exportPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      console.log("[quotation-pdf] export requested", {
        quotationId: quotation.id,
        quoteNo: quotation.quoteNo,
        itemCount: quotation.items?.length ?? 0,
        hasGlobalConfig: Boolean(globalConfig),
        hasLogo: Boolean(globalConfig?.logoUrl || globalConfig?.logo)
      });
      const blob = await generateQuotationPDFBlob({
        ...quotation,
        globalConfig
      });
      const nextPdfPreviewUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextPdfPreviewUrl;
      });
      setIsPdfPreviewOpen(true);
      console.log("[quotation-pdf] export completed");
    } catch (error) {
      console.error("Failed to export quotation PDF", error);
      alert("Failed to generate PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  const closePdfPreview = () => {
    setIsPdfPreviewOpen(false);
  };
  const downloadPreviewedPdf = () => {
    if (!pdfPreviewUrl) return;
    const link = document.createElement("a");
    link.href = pdfPreviewUrl;
    link.download = getQuotationPdfDownloadName({
      ...quotation,
      globalConfig
    });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const isCreateMode = quotationBasePath === "/quotations/new";
  const pageTitle = isCreateMode ? "Create Quotation" : "Edit Quotation";
  const pageDescription = quotation.quoteNo ? `#${quotation.quoteNo}` : "";

  return (
    <PageShell
      title={pageTitle}
      description={pageDescription}
      actions={
        <>
          <Badge variant="outline">{quotation.status}</Badge>
          <Badge variant="success">{saveState}</Badge>
          <Button variant="outline" onClick={exportPdf} disabled={isGeneratingPdf}>
            <Download className="h-4 w-4" />
            {isGeneratingPdf ? "Generating..." : "PDF"}
          </Button>
          <Button variant="outline">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button onClick={handleSave}>
  Save
</Button>
        </>
      }
    >
      <div id="quotation-pdf-root" className="space-y-6">
          <Card className="border-0 bg-white/90">
            <CardContent className="flex flex-wrap gap-3 p-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-2xl px-4 py-2 text-sm transition ${
                    activeTab === tab.key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </CardContent>
          </Card>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === "customer" && <CustomerTab />}
              {activeTab === "quotation" && <QuotationDetailsTab />}
              {activeTab === "global" && (
  <GlobalConfigTab
    globalConfig={globalConfig}
    setGlobalConfig={setGlobalConfig}
    logoPreview={logoPreview}
    handleLogoUpload={handleLogoUpload}
  />
)}
              {activeTab === "item" && <ItemTab quotationBasePath={quotationBasePath} />}

            </motion.div>
          </AnimatePresence>
          {isPdfPreviewOpen && pdfPreviewUrl ? (
            <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/70 p-4">
              <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Quotation PDF Preview</div>
                    <div className="text-sm text-slate-500">{getQuotationPdfDownloadName({ ...quotation, globalConfig })}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={downloadPreviewedPdf}>
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button variant="outline" onClick={closePdfPreview}>
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 bg-slate-100 p-4">
                  <iframe
                    title="Quotation PDF Preview"
                    src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="h-full w-full rounded-2xl border border-slate-200 bg-white"
                  />
                </div>
              </div>
            </div>
          ) : null}
      </div>
    </PageShell>
  );
}

function Field({
  label,
  children,
  className,
  dark
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div className={className}>
      <Label className={dark ? "text-slate-200" : undefined}>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PriceRow({ label, value, emphasized }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${emphasized ? "text-lg font-semibold" : ""}`}>
      <span className={emphasized ? "" : "text-slate-300"}>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
