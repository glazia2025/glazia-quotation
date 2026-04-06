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
  Expand,
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
import { calculateQuotationTotals, getArea, getItemGrandTotal, getPerimeter } from "@/modules/quotation/utils/calculations";
import type { QuotationItem } from "@/types/quotation";
import { formatCurrency, formatNumber } from "@/utils/format";
import { useRouter } from "next/navigation";
import axios from "axios";
import { API_BASE_URL } from "@/services/api";
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
function ItemCard() {
  return (
    <div className="bg-white rounded-2xl shadow-md border p-4 space-y-4 hover:shadow-lg transition">

      {/* IMAGE PLACEHOLDER */}
      <div className="w-full h-30 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400">
         <img
    src="/images/image.png"
    alt="item"
    className="w-full h-full object-cover"
  />
      </div>

      {/* REF CODE */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Ref Code</span>
        <span className="font-semibold">W2-1</span>
      </div>

      {/* LOCATION */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Location</span>
        <span className="font-medium text-right">
          Floor: GF &gt; Kitchen-Gf
        </span>
      </div>


      {/*SYSTEM */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">System</span>
        <span className="font-medium">Casement</span>
      </div>

      {/*DESCRIPTION */}
      <div className="text-sm">
        <span className="text-gray-500">Description</span>
        <p className="font-medium mt-1">
          Left-Open windoow
        </p>
      </div>

      {/*GLASS */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Glass</span>
        <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs font-semibold">
          Yes
        </span>
      </div>

      <div className="flex justify-between items-center pt-3 border-t">
  <button className="px-4 py-2 bg-[#124657] text-white rounded-lg text-sm font-semibold hover:bg-[#0b3642] transition">
    Edit Quotation
  </button>
</div>
    </div>
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
function ItemTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ItemCard />
      <ItemCard />
      <ItemCard />
    </div>
  );
}
function CustomerTab() {
  const customer = useQuotationBuilderStore((state) => state.quotation.customer);
  const updateCustomer = useQuotationBuilderStore((state) => state.updateCustomer);

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
              value={customer.customerName}
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
              value={customer.email}
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
              value={customer.phone}
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
              value={customer.siteAddress}
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
              value={customer.city || ""}
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
              value={customer.state || ""}
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
              value={customer.pincode || ""}
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


export function QuotationBuilder() {
 useEffect(() => {
  const fetchData = async () => {
    const data = await loadGlobalConfig();
    if (data) {
      setGlobalConfig(data);
    }
  };

  fetchData();
}, []);


   const router = useRouter();
    
  const [activeTab, setActiveTab] = useState<TabKey>("customer");
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
const handleSave = async () => {
  const payload = {
    quotationDetails: quotation,
    customerDetails: quotation.customer,
    items: quotation.items,
    globalConfig: globalConfig,
  };

  try {
    await axios.post(
      `${API_BASE_URL}/api/quotations`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    alert("Saved successfully ");
  } catch (err) {
    console.error(err);
    alert("Error saving ");
  }
};

  const { quotation, totals, saveState } = useQuotationBuilder();
  const { can } = useRbac();
  const setStatus = useQuotationBuilderStore((state) => state.setStatus);
  const addItem = useQuotationBuilderStore((state) => state.addItem);
  const [profit, setProfit] = useState(0);
  const currentItem = quotation.items[0];
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
const totalQuantity = quotation.items.reduce(
  (sum, item) => sum + Math.max(1, item.quantity || 1),
  0
);

const totalArea = quotation.items.reduce(
  (sum, item) => sum + (getArea(item) * Math.max(1, item.quantity || 1)),
  0
);

const totalAmount = quotation.items.reduce(
  (sum, item) => sum + (item.amount || 0),
  0
);

const finalAmount = totalAmount + (totalAmount * profit) / 100;

const finalWithGST = finalAmount + (finalAmount * 18) / 100;

  const exportPdf = async () => {
    const html2pdf = (await import("html2pdf.js")).default;
    const element = document.getElementById("quotation-pdf-root");
    if (!element) return;
    await html2pdf().from(element).set({ margin: 12, filename: `${quotation.quoteNo}.pdf` }).save();
  };

  return (
    <PageShell
      title="Edit Quotation"
   description={`#${quotation.quoteNo || ""}`}
      actions={
        <>
          <Badge variant="outline">{quotation.status}</Badge>
          <Badge variant="success">{saveState}</Badge>
          <Button variant="outline" onClick={exportPdf}>
            <Download className="h-4 w-4" />
            PDF
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
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
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
{activeTab === "item" && <ItemTab />}

            </motion.div>
          </AnimatePresence>
        </div>
        <div className="space-y-6 xl:sticky xl:top-24 xl:h-fit">
       
          <Card id="quotation-pdf-root" className="border-0 bg-slate-950 text-white">
            <CardHeader>
              <CardTitle>Live Summary</CardTitle>
              <CardDescription className="text-slate-300">Items</CardDescription>
              
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-center">

  <div>
    <div className="text-sm text-slate-400">Total Quantity</div>
    <div className="text-lg font-bold">{totalQuantity}</div>
  </div>

  <div>
    <div className="text-sm text-slate-400">Total Area</div>
    <div className="text-lg font-bold">{formatNumber(totalArea)}</div>
  </div>

  <div>
    <div className="text-sm text-slate-400">Profit %</div>
    <input
      type="number"
      value={profit}
      onChange={(e) => setProfit(Number(e.target.value))}
      className="mt-1 w-20 px-2 py-1 text-black rounded"
    />
  </div>

  <div>
    <div className="text-sm text-slate-400">Total Amount</div>
    <div className="text-lg font-bold">
      {formatCurrency(totalAmount)}
    </div>
  </div>

  <div>
    <div className="text-sm text-slate-400">Final Amount</div>
    <div className="text-lg font-bold">
      {formatCurrency(finalAmount)}
    </div>
  </div>

  <div>
    <div className="text-sm text-slate-400">Final Amount with GST</div>
    <div className="text-lg font-bold">
      {formatCurrency(finalWithGST)}
    </div>
  </div>
</div>
              
              <Separator className="bg-white/10" />
              <div className="grid gap-2">
                <Button
  size="sm" asChild>
    <Link href={`/quotations/new/configurator/${currentItem.id}`}>
    <Expand className="h-4 w-4"/>
    Add item
    </Link>
  </Button>
 
  {/* <button
  onClick={() => {
    const newId = addItem();

    console.log("NEW ID:", newId);

    if (newId) {
      router.push(`/quotations/new/configurator/${newId}`);
    }
  }}
  className="w-full bg-[#124657] text-white px-4 py-2 rounded-lg"
>
  Add item
</button> */}

              </div>
            </CardContent>
          </Card>
        </div>
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
