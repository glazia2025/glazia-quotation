"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

const customerSchema = z.object({
  customerName: z.string().min(2),
  contactPerson: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email(),
  projectName: z.string().min(2),
  siteAddress: z.string().min(3)
});

type TabKey = "customer" | "items" | "pricing" | "terms" | "attachments" | "history";

const tabs: { key: TabKey; label: string }[] = [
  { key: "customer", label: "Customer Info" },
  { key: "items", label: "Items" },
  { key: "pricing", label: "Pricing Summary" },
  { key: "terms", label: "Terms & Notes" },
  { key: "attachments", label: "Attachments" },
  { key: "history", label: "History / Versions" }
];

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

function ItemsTab() {
  const { quotation, selectedItemId, addItem, duplicateItem, removeItem, selectItem, updateItem } = useQuotationBuilderStore();
  const item = quotation.items.find((entry) => entry.id === selectedItemId) ?? quotation.items[0];

  const series = getSeries(item.material);
  const designs = getDesigns(item.series);
  const openings = getOpenings(item.designType);

  const handleItemUpdate = <K extends keyof QuotationItem>(key: K, value: QuotationItem[K]) => {
    updateItem(item.id, {
      [key]: value,
      previewPanels:
        key === "designType" && typeof value === "string" && value.includes("3 Panel")
          ? 3
          : key === "designType" && typeof value === "string" && value.includes("4")
            ? 4
            : item.previewPanels
    } as Partial<QuotationItem>);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
      <Card className="border-0 bg-white/90">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Configured Items</CardTitle>
            <CardDescription>Build quotation lines with pricing-ready configuration.</CardDescription>
          </div>
          <Button size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotation.items.map((entry, index) => (
            <button
              key={entry.id}
              onClick={() => selectItem(entry.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                entry.id === item.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-100 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] opacity-70">Item {index + 1}</div>
                  <div className="mt-1 font-medium">{entry.projectLocation}</div>
                </div>
                <Badge variant={entry.id === item.id ? "success" : "outline"}>{entry.productType}</Badge>
              </div>
              <div className="mt-3 text-sm opacity-80">
                {entry.material} | {entry.series}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="border-0 bg-white/90">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Item Builder</CardTitle>
            <CardDescription>Use the full-page configurator for uninterrupted product setup, then return to pricing and approval.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild>
              <Link href={`/quotations/new/configurator/${item.id}`}>
                <Expand className="h-4 w-4" />
                Open Configurator
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => duplicateItem(item.id)}>
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">Recommended workflow</div>
                <div className="max-w-2xl text-sm text-slate-600">
                  Configure material, series, design, openings, dimensions, and accessories in the dedicated full-page workspace. This quotation tab stays focused on item list management and quick commercial checks.
                </div>
              </div>
              <Button asChild>
                <Link href={`/quotations/new/configurator/${item.id}`}>
                  Launch Full Configurator
                  <Expand className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Project / Location">
              <Input value={item.projectLocation} onChange={(event) => handleItemUpdate("projectLocation", event.target.value)} />
            </Field>
            <Field label="Product Type">
              <Select
                value={item.productType}
                onChange={(event) => handleItemUpdate("productType", event.target.value)}
                options={[
                  { label: "Window", value: "Window" },
                  { label: "Door", value: "Door" },
                  { label: "Facade", value: "Facade" }
                ]}
              />
            </Field>
            <Field label="Material">
              <Select
                value={item.material}
                onChange={(event) => {
                  const material = event.target.value;
                  const nextSeries = getSeries(material)[0] ?? "";
                  const nextDesign = getDesigns(nextSeries)[0] ?? "";
                  handleItemUpdate("material", material);
                  updateItem(item.id, {
                    series: nextSeries,
                    designType: nextDesign,
                    openingType: getOpenings(nextDesign)[0] ?? ""
                  });
                }}
                options={materials.map((material) => ({ label: material, value: material }))}
              />
            </Field>
            <Field label="Series">
              <Select value={item.series} onChange={(event) => handleItemUpdate("series", event.target.value)} options={series.map((seriesItem) => ({ label: seriesItem, value: seriesItem }))} />
            </Field>
            <Field label="Design Type">
              <Select
                value={item.designType}
                onChange={(event) => {
                  const designType = event.target.value;
                  handleItemUpdate("designType", designType);
                  updateItem(item.id, {
                    openingType: getOpenings(designType)[0] ?? item.openingType,
                    previewPanels: designType.includes("3 Panel") ? 3 : designType.includes("2 Panel") ? 2 : 1
                  });
                }}
                options={designs.map((design) => ({ label: design, value: design }))}
              />
            </Field>
            <Field label="Opening Type">
              <Select value={item.openingType} onChange={(event) => handleItemUpdate("openingType", event.target.value)} options={openings.map((opening) => ({ label: opening, value: opening }))} />
            </Field>
            <Field label="Width (inches)">
              <Input type="number" value={item.width} onChange={(event) => handleItemUpdate("width", Number(event.target.value))} />
            </Field>
            <Field label="Height (inches)">
              <Input type="number" value={item.height} onChange={(event) => handleItemUpdate("height", Number(event.target.value))} />
            </Field>
            <Field label="Quantity">
              <Input type="number" value={item.quantity} onChange={(event) => handleItemUpdate("quantity", Number(event.target.value))} />
            </Field>
            <Field label="Glass Type">
              <Select value={item.glassType} onChange={(event) => handleItemUpdate("glassType", event.target.value)} options={glassTypes.map((glass) => ({ label: glass, value: glass }))} />
            </Field>
            <Field label="Color / Finish">
              <Select value={item.colorFinish} onChange={(event) => handleItemUpdate("colorFinish", event.target.value)} options={finishes.map((finish) => ({ label: finish, value: finish }))} />
            </Field>
            <Field label="System Type">
              <Select
                value={item.systemType ?? item.openingType}
                onChange={(event) => handleItemUpdate("systemType", event.target.value)}
                options={[
                  { label: "Casement", value: "Casement" },
                  { label: "Sliding", value: "Sliding" },
                  { label: "Slide N Fold", value: "Slide N Fold" },
                  { label: "Fixed", value: "Fixed" }
                ]}
              />
            </Field>
            <Field label="Rate / Sq.ft">
              <Input type="number" value={item.rate} onChange={(event) => handleItemUpdate("rate", Number(event.target.value))} />
            </Field>
          </div>
          <div className="space-y-3">
            <Label>Accessories</Label>
            <div className="grid gap-3 md:grid-cols-2">
              {accessoryCatalog.map((accessory) => {
                const active = item.accessories.includes(accessory.id);
                return (
                  <button
                    key={accessory.id}
                    onClick={() =>
                      handleItemUpdate(
                        "accessories",
                        active
                          ? item.accessories.filter((entry) => entry !== accessory.id)
                          : [...item.accessories, accessory.id]
                      )
                    }
                    className={`rounded-2xl border p-3 text-left transition ${
                      active ? "border-teal-700 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-slate-900">{accessory.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatCurrency(accessory.rate)} / {accessory.unit}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Special Notes">
            <Textarea value={item.specialNotes} onChange={(event) => handleItemUpdate("specialNotes", event.target.value)} />
          </Field>
          <QuotationPreview item={item} />
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerTab() {
  const customer = useQuotationBuilderStore((state) => state.quotation.customer);
  const updateCustomer = useQuotationBuilderStore((state) => state.updateCustomer);
  const form = useForm({
    resolver: zodResolver(customerSchema),
    values: customer
  });

  return (
    <Card className="border-0 bg-white/90">
      <CardHeader>
        <CardTitle>Customer Information</CardTitle>
        <CardDescription>Tenant-scoped customer, project, and site details used in the quotation and PDF output.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["customerName", "Customer Name"],
            ["contactPerson", "Contact Person"],
            ["phone", "Phone"],
            ["email", "Email"],
            ["projectName", "Project Name"]
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <Input
              {...form.register(key)}
              value={customer[key]}
              onChange={(event) => updateCustomer(key, event.target.value)}
            />
          </Field>
        ))}
        <Field label="Site Address" className="md:col-span-2">
          <Textarea
            {...form.register("siteAddress")}
            value={customer.siteAddress}
            onChange={(event) => updateCustomer("siteAddress", event.target.value)}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function PricingTab() {
  const quotation = useQuotationBuilderStore((state) => state.quotation);
  const taxPercent = useQuotationBuilderStore((state) => state.taxPercent);
  const globalDiscount = useQuotationBuilderStore((state) => state.globalDiscount);
  const totals = useMemo(
    () => calculateQuotationTotals(quotation.items, taxPercent, globalDiscount),
    [globalDiscount, quotation.items, taxPercent]
  );
  const { can } = useRbac();
  const setPricingMeta = useQuotationBuilderStore((state) => state.setPricingMeta);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <Card className="border-0 bg-white/90">
        <CardHeader>
          <CardTitle>Item Pricing Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotation.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">{item.projectLocation}</div>
                  <div className="text-sm text-slate-500">
                    {formatNumber(getArea(item))} sq.ft x {item.quantity}
                  </div>
                </div>
                <div className="text-right font-semibold text-slate-900">{formatCurrency(getItemGrandTotal(item))}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-0 bg-slate-950 text-white">
        <CardHeader>
          <CardTitle>Commercials</CardTitle>
          <CardDescription className="text-slate-300">Overrides are permission controlled at the UI level.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Tax (%)" dark>
            <Input
              type="number"
              disabled={!can("quotations.override_pricing")}
              value={taxPercent}
              onChange={(event) => setPricingMeta(Number(event.target.value), globalDiscount)}
            />
          </Field>
          <Field label="Global Discount" dark>
            <Input
              type="number"
              disabled={!can("quotations.override_pricing")}
              value={globalDiscount}
              onChange={(event) => setPricingMeta(taxPercent, Number(event.target.value))}
            />
          </Field>
          <Separator className="bg-white/10" />
          <PriceRow label="Subtotal" value={totals.subtotal} />
          <PriceRow label="Accessories" value={totals.accessoriesTotal} />
          <PriceRow label="Labor" value={totals.laborTotal} />
          <PriceRow label="Transport" value={totals.transportTotal} />
          <PriceRow label="Discount" value={-totals.discountTotal} />
          <PriceRow label="Taxable" value={totals.taxableAmount} />
          <PriceRow label="Tax" value={totals.taxTotal} />
          <Separator className="bg-white/10" />
          <PriceRow label="Grand Total" value={totals.grandTotal} emphasized />
        </CardContent>
      </Card>
    </div>
  );
}

function TermsTab() {
  const { quotation, updateQuotationField } = useQuotationBuilderStore();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-0 bg-white/90">
        <CardHeader>
          <CardTitle>Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={quotation.terms} onChange={(event) => updateQuotationField("terms", event.target.value)} className="min-h-[280px]" />
        </CardContent>
      </Card>
      <Card className="border-0 bg-white/90">
        <CardHeader>
          <CardTitle>Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={quotation.internalNotes} onChange={(event) => updateQuotationField("internalNotes", event.target.value)} className="min-h-[280px]" />
        </CardContent>
      </Card>
    </div>
  );
}

function AttachmentsTab() {
  const attachments = useQuotationBuilderStore((state) => state.quotation.attachments);

  return (
    <Card className="border-0 bg-white/90">
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <CardDescription>Supporting drawings, compliance files, and measurement references.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="rounded-2xl border border-dashed border-slate-300 p-4">
            <div className="font-medium text-slate-900">{attachment.name}</div>
            <div className="mt-2 text-sm text-slate-500">{attachment.type}</div>
          </div>
        ))}
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
          Upload area placeholder
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryTab() {
  const { quotation, addRevision, rollbackToRevision } = useQuotationBuilderStore();
  const compareSummary = useMemo(() => {
    const [latest, previous] = quotation.revisions;
    if (!latest || !previous) return "No prior revision available for comparison.";
    return `Latest ${latest.version} changed total by ${formatCurrency(
      latest.snapshotTotals.grandTotal - previous.snapshotTotals.grandTotal
    )} versus ${previous.version}.`;
  }, [quotation.revisions]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-0 bg-white/90">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Revision Timeline</CardTitle>
            <CardDescription>{compareSummary}</CardDescription>
          </div>
          <Button size="sm" onClick={() => addRevision("Commercial adjustments captured")}>
            <FileClock className="h-4 w-4" />
            Create Revision
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotation.revisions.map((revision) => (
            <div key={revision.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">{revision.version}</div>
                  <div className="text-sm text-slate-500">{revision.summary}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => rollbackToRevision(revision.id)}>
                  <RotateCcw className="h-4 w-4" />
                  Rollback
                </Button>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {revision.by} | {formatDistanceToNow(new Date(revision.at), { addSuffix: true })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-0 bg-slate-950 text-white">
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotation.history.map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-white/5 p-4">
              <div className="font-medium">{entry.title}</div>
              <div className="mt-1 text-sm text-slate-300">{entry.description}</div>
              <div className="mt-2 text-xs text-slate-400">
                {entry.by} | {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function QuotationBuilder() {
  const [activeTab, setActiveTab] = useState<TabKey>("items");
  const { quotation, totals, saveState } = useQuotationBuilder();
  const { can } = useRbac();
  const setStatus = useQuotationBuilderStore((state) => state.setStatus);

  const statusActions: {
    label: string;
    status: "Submitted" | "Approved" | "Rejected" | "Converted";
    icon: typeof Send;
    permission?: "quotations.approve" | "quotations.convert";
  }[] = [
    { label: "Submit", status: "Submitted", icon: Send },
    { label: "Approve", status: "Approved", icon: CheckCircle2, permission: "quotations.approve" as const },
    { label: "Reject", status: "Rejected", icon: XCircle, permission: "quotations.approve" as const },
    { label: "Convert", status: "Converted", icon: WandSparkles, permission: "quotations.convert" as const }
  ];

  const exportPdf = async () => {
    const html2pdf = (await import("html2pdf.js")).default;
    const element = document.getElementById("quotation-pdf-root");
    if (!element) return;
    await html2pdf().from(element).set({ margin: 12, filename: `${quotation.quoteNo}.pdf` }).save();
  };

  return (
    <PageShell
      title={`${quotation.quoteNo} Builder`}
      description="Quotation-first workspace with live pricing, autosave draft behavior, configurable items, and revision control."
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
              {activeTab === "items" && <ItemsTab />}
              {activeTab === "pricing" && <PricingTab />}
              {activeTab === "terms" && <TermsTab />}
              {activeTab === "attachments" && <AttachmentsTab />}
              {activeTab === "history" && <HistoryTab />}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="space-y-6 xl:sticky xl:top-24 xl:h-fit">
          <Card id="quotation-pdf-root" className="border-0 bg-slate-950 text-white">
            <CardHeader>
              <CardTitle>Live Summary</CardTitle>
              <CardDescription className="text-slate-300">Sticky commercial summary and status actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Customer</div>
                <div className="mt-2 font-medium">{quotation.customer.customerName || "Unassigned customer"}</div>
                <div className="text-sm text-slate-300">{quotation.customer.projectName || "Project not named"}</div>
              </div>
              {quotation.items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{item.projectLocation}</div>
                    <div>{formatCurrency(getItemGrandTotal(item))}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {item.material} {item.series}
                  </div>
                </div>
              ))}
              <Separator className="bg-white/10" />
              <PriceRow label="Grand Total" value={totals.grandTotal} emphasized />
              <div className="grid gap-2">
                {statusActions.map((action) => {
                  if (action.permission && !can(action.permission)) return null;
                  return (
                    <Button key={action.label} variant={action.status === "Rejected" ? "destructive" : "secondary"} onClick={() => setStatus(action.status)}>
                      <action.icon className="h-4 w-4" />
                      {action.label}
                    </Button>
                  );
                })}
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
