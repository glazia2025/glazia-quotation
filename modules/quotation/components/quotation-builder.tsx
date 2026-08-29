"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { CustomSelect } from "@/components/ui/CustomSelect";

import {
  Copy,
  Download,
  Plus,
  Ruler,
  Share2,
  Upload,
  ShoppingCart,
  Scissors,
  Box,
  FileText,
  Monitor,
  ArrowLeft,
  UserRound,
  Mail,
  Phone,
  MapPin,
  Building2,
  MapPinned,
  Hash,
  X,
  Image as ImageIcon,
  Settings2,
  Trash2


} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/shared/page-shell";
import { useQuotationBuilder } from "@/modules/quotation/hooks/use-quotation-builder";
import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";
import { getArea, getPerimeter } from "@/modules/quotation/utils/calculations";
import { createEmptyQuotation } from "@/modules/quotation/utils/factory";
import {
  bulkUpdateQuotationItems,
  createQuotationItem,
  deleteQuotationItem,
  getBomOrderData,
  getBomPdfBlob,
  getCuttingSchedulePdfBlob,
  getQuotationPdfBlob,
  prepareQuotationPdf,
  getQuotationPdfStatus,
  saveQuotationMetadata,
  getElevationPdfBlob,
  getOptimizedFinal,
  reorderQuotationItems,
  getQuotationExcelBlob,
  getQuotation,
  calculateQuotationRates,
  getGlassReportPdfBlob,
  shareQuotationPdf,
  getQuotationMetadataSaveFingerprint,
} from "@/services/quotation-service";
import type { BomOrderData } from "@/services/quotation-service";
import { BomOrderPlacement } from "@/modules/quotation/components/bom-order-placement";

import type { Quotation, QuotationItem } from "@/types/quotation";
import { formatCurrency, formatNumber } from "@/utils/format";
import { getQuotationPdfDownloadName } from "@/utils/quotationPdf";
import { useRouter, useSearchParams } from "next/navigation";
import { loadGlobalConfig } from "../../../utils/globalConfig";
import { fetchDescriptions, fetchOptions } from "@/lib/quotations/api";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";

import {
  SortableContext,
} from "@dnd-kit/sortable";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy } from "@dnd-kit/sortable";


type TabKey = "Details" | "global" | "item" | "bulk";

const tabs: { key: TabKey; label: string }[] = [
  { key: "Details", label: " Details" },
  { key: "global", label: "Global Config" },
  { key: "item", label: "Item List" },
  { key: "bulk", label: "Global Edit" },
];
const isTabKey = (value: string | null): value is TabKey =>
  value === "Details" || value === "global" || value === "item" || value === "bulk";


const formatDimensionMm = (value: number | string | undefined) => `${value ?? "-"} mm`;
const formatSizeMm = (width: number | string | undefined, height: number | string | undefined) =>
  `${formatDimensionMm(width)} x ${formatDimensionMm(height)}`;
const formatRateCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
const getQuotationItemIdentity = (item: QuotationItem) => {
  const withBackendId = item as QuotationItem & { _id?: string };
  return String(item.id || withBackendId._id || item.refCode || "");
};
const getServerQuotationItemId = (item: QuotationItem) =>
  [item._id, item.id].map(String).find((value) => /^[a-f\d]{24}$/i.test(value)) || "";

const createBuilderGlobalConfig = () => ({
  isOverridden: false,
  logo: "",
  logoUrl: "",
  prerequisites: "",
  paymentInfo: "",
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

const getQuotationIdentity = (quotation: Quotation | null | undefined) =>
  quotation?._id || quotation?.generatedId || quotation?.quotationDetails?.id || "";

const EXHAUST_FAN_RATE_SURCHARGE = 10;

function ItemCard({
  item,
  index,
  configuratorBasePath,
  onDeleteItem,
  onDuplicateItem,
}: {
  item: QuotationItem;
  index: number;
  configuratorBasePath: string;
  onDeleteItem: (item: QuotationItem) => Promise<void>;
  onDuplicateItem: (
    item: QuotationItem,
    refCode: string,
    dimensions?: {
      parent: {
        width: string;
        height: string;
      };
      sections: {
        width: string;
        height: string;
      }[];
    }
  ) => Promise<void>;
}) {
  console.log("CARD ITEM", item);
  console.log(
    "CONFIG LAYOUT",
    item.configuratorLayout
  );

  const [showSections, setShowSections] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [duplicateStep, setDuplicateStep] = useState<1 | 2>(1);
  const [duplicateCount, setDuplicateCount] = useState(1);
  const [duplicateCountInput, setDuplicateCountInput] = useState("1");
  const [duplicateRefCodes, setDuplicateRefCodes] = useState([""]);
  const [duplicateWindows, setDuplicateWindows] = useState<
    {
      parent: {
        width: string;
        height: string;
      };
      sections: {
        width: string;
        height: string;
      }[];
    }[]
  >([]);
  const [duplicateError, setDuplicateError] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const systemLabel = item.systemType || item.series || item.openingType || "Not configured";
  const locationLabel = item.location || item.projectLocation || "Not specified";
  const refCodeLabel = item.refCode || (item.id ? item.id.slice(0, 8).toUpperCase() : "Item");
  const hasSections = (item.subItems?.length ?? 0) > 1 || item.systemType === "Combination";
  const itemIdentity = getQuotationItemIdentity(item);

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setIsMutating(true);
    try {
      await onDeleteItem(item);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Failed to delete quotation item", error);
      alert("Failed to delete the quotation item.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleDuplicate = () => {
    setDuplicateStep(1);
    setDuplicateCount(1);
    setDuplicateCountInput("1");
    setDuplicateRefCodes([""]);
    setDuplicateWindows([
      {
        parent: {
          width: String(item.width),
          height: String(item.height),
        },
        sections: (item.subItems ?? []).map((subItem) => ({
          width: String(subItem.width),
          height: String(subItem.height),
        })),
      },
    ]);
    setDuplicateError("");
    setIsDuplicateModalOpen(true);
  };


  const confirmDuplicate = async () => {
    const refCodes = duplicateRefCodes.map((code) => code.trim());

    if (refCodes.some((code) => !code)) {
      setDuplicateError("Please enter all Ref Codes.");
      return;
    }

    const uniqueRefCodes = new Set(refCodes);

    if (uniqueRefCodes.size !== refCodes.length) {
      setDuplicateError("Ref Codes must be unique.");
      return;
    }

    setIsMutating(true);

    try {
      for (let index = 0; index < refCodes.length; index++) {
        await onDuplicateItem(
          item,
          refCodes[index],
          duplicateWindows[index]
        );
      }

      setIsDuplicateModalOpen(false);
      setDuplicateStep(1);
      setDuplicateCount(1);
      setDuplicateCountInput("1");
      setDuplicateRefCodes([""]);
      setDuplicateError("");
    } catch (error) {
      console.error("Failed to duplicate quotation item", error);
      setDuplicateError("Failed to duplicate this item.");
    } finally {
      setIsMutating(false);
    }
  };
  return (
    <>
      <div className="self-start space-y-2 rounded-2xl border bg-white p-3 shadow-sm transition hover:shadow-md">
        <div className="px-1 text-xs font-medium text-gray-400">
          {String(index + 1).padStart(2, "0")}
        </div>
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
        <div className="mt-3 space-y-3">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
                REF CODE
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {refCodeLabel}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
                RATE
              </p>
              <p className="mt-1 text-sm font-semibold text-red-500">
                {/* {formatCurrency(item.rate ?? 0)} */}
                {formatRateCurrency(item.rate ?? 0)}
              </p>
            </div>
          </div>

          {/* Location + Area */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
                LOCATION
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-900">
                {locationLabel}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
                AREA
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-900">
                {formatNumber(item.area ?? getArea(item))} sq.ft
              </p>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
              SYSTEM
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-900">
              {systemLabel}
            </p>
          </div>

        </div>
        {/*  Arch Note */}
        {item?.systemType?.toLowerCase() === "casement" &&
          item?.archType &&
          item.archType !== "none" && (
            <div className="text-xs text-black-600 mt-1 px-1">
              + ₹5000 added in amount for arching the product
            </div>
          )}

        <div className="flex flex-nowwrap items-center gap-1 border-t pt-2" onPointerDown={(event) => event.stopPropagation()}>
          <Button size="sm" asChild className=" h-8 shrink-0 px-2.5 bg-[#0F172A] hover:bg-[#0F172A]">
            <Link href={`${configuratorBasePath}/${itemIdentity}`}>Edit</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={handleDuplicate} title="Duplicate item" className=" h-8 shrink-0  gap-1 px-2.5 whitespace-nowrap">
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          {hasSections ? (
            <Button size="sm" variant="outline" onClick={() => setShowSections(true)} className="h-8 shrink-0 px-2.5 whitespace-nowrap">
              Show Sections
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={handleDelete} className="h-10 w-10 shrink-0 text-red-600 hover:text-red-700">
            <Trash2 className="h-6 w-6" />
          </Button>
        </div>
      </div>
      {/* </div> */}
      {showSections ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/60 p-4" onPointerDown={(event) => event.stopPropagation()}>
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Sections</h3>
                <p className="text-sm text-slate-500">{refCodeLabel} | {locationLabel}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowSections(false)} className="border-[#0F172A] bg-[#0F172A] text-white hover:bg-[#0F172A] hover:text-white">
                Close
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-6">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-900">
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
                      <td className="px-3 py-3 text-slate-600">{formatSizeMm(section.width, section.height)}</td>
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
      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4" onPointerDown={(event) => event.stopPropagation()}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Item</h3>
            <p className="mt-2 text-sm text-slate-600">Delete item {refCodeLabel}? This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmDelete} disabled={isMutating} className="bg-red-600 text-white hover:bg-red-700">
                {isMutating ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {isDuplicateModalOpen ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4" onPointerDown={(event) => event.stopPropagation()}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="overflow-y-auto p-6">
              <h3 className="text-lg font-semibold text-slate-900">Duplicate Item</h3>
              <p className="mt-1 text-sm text-slate-500">Enter a new ref code for {refCodeLabel}.</p>
              {duplicateStep === 1 && (
                <label className="mt-5 block text-sm font-medium text-slate-700">
                  Number of  Duplicate Windows you want to make?
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={duplicateCountInput}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDuplicateCountInput(value);
                      if (value === "") {
                        return;
                      }

                      const count = Math.max(
                        1,
                        Math.min(100, Number(value))
                      );
                      setDuplicateCount(count);

                      setDuplicateRefCodes((prev) => {
                        const next = [...prev];

                        while (next.length < count) {
                          next.push("");
                        }

                        return next.slice(0, count);
                      });

                      setDuplicateError("");
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]/20"
                  />
                </label>
              )}
              {duplicateStep === 2 && (

                <div className="mt-5 space-y-4">

                  {duplicateRefCodes.map((refCode, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="grid grid-cols-3 gap-4">
                        <label className="text-sm font-medium text-slate-700">
                          Ref Code {index + 1}
                          <input
                            value={refCode}
                            onChange={(event) => {
                              const value = event.target.value;

                              setDuplicateRefCodes((prev) => {
                                const next = [...prev];
                                next[index] = value;
                                return next;
                              });

                              setDuplicateError("");
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") confirmDuplicate();
                              if (event.key === "Escape") setIsDuplicateModalOpen(false);
                            }}
                            autoFocus={index === 0}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]/20"
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          Width
                          <input
                            type="number"
                            value={duplicateWindows[index]?.parent.width ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;

                              setDuplicateWindows((prev) => {
                                const next = [...prev];

                                next[index] = {
                                  ...next[index],
                                  parent: {
                                    ...next[index].parent,
                                    width: value,
                                  },
                                };

                                return [...next];
                              });
                            }}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]/20"
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          Height
                          <input
                            type="number"
                            value={duplicateWindows[index]?.parent.height ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;

                              setDuplicateWindows((prev) => {
                                const next = [...prev];

                                next[index] = {
                                  ...next[index],
                                  parent: {
                                    ...next[index].parent,
                                    height: value,
                                  },
                                };

                                return [...next];
                              });
                            }}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]/20"
                          />
                        </label>
                      </div>

                      {duplicateWindows[index]?.sections.length ? (
                        <div className="mt-4 space-y-3">
                          {duplicateWindows[index].sections.map((section, sectionIndex) => (
                            <div
                              key={sectionIndex}
                              className="rounded-lg border border-slate-200 p-3"
                            >
                              <p className="mb-3 text-sm font-semibold text-slate-700">
                                Window {sectionIndex + 1}
                              </p>

                              <div className="grid grid-cols-2 gap-3">
                                <label className="text-sm font-medium text-slate-700">
                                  Width
                                  <input
                                    type="number"
                                    value={section.width}
                                    onChange={(event) => {
                                      const value = event.target.value;

                                      setDuplicateWindows((prev) => {
                                        const next = [...prev];

                                        next[index].sections[sectionIndex] = {
                                          ...next[index].sections[sectionIndex],
                                          width: value,
                                        };

                                        return [...next];
                                      });
                                    }}
                                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]/20"
                                  />
                                </label>

                                <label className="text-sm font-medium text-slate-700">
                                  Height
                                  <input
                                    type="number"
                                    value={section.height}
                                    onChange={(event) => {
                                      const value = event.target.value;

                                      setDuplicateWindows((prev) => {
                                        const next = [...prev];

                                        next[index].sections[sectionIndex] = {
                                          ...next[index].sections[sectionIndex],
                                          height: value,
                                        };

                                        return [...next];
                                      });
                                    }}
                                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]/20"
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {duplicateError ? <p className="mt-2 text-sm text-red-600">{duplicateError}</p> : null}
            </div>
            <div className="border-t p-6">
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (duplicateStep === 2) {
                      setDuplicateStep(1);
                      setDuplicateError("");
                      return;
                    }

                    setIsDuplicateModalOpen(false);
                    setDuplicateError("");
                  }}
                >
                  {duplicateStep === 2 ? "Back" : "Cancel"}
                </Button>

                {duplicateStep === 1 ? (
                  <Button
                    size="sm"
                    className="bg-[#0F172A] hover:bg-[#0F172A]"
                    onClick={() => {
                      const count = Number(duplicateCountInput);

                      if (!duplicateCountInput.trim()) {
                        setDuplicateError("Please enter the number of windows.");
                        return;
                      }

                      if (Number.isNaN(count) || count < 1 || count > 100) {
                        setDuplicateError("Number of windows must be between 1 and 100.");
                        return;
                      }

                      setDuplicateCount(count);

                      setDuplicateRefCodes((prev) => {
                        const next = [...prev];

                        while (next.length < count) {
                          next.push("");
                        }

                        return next.slice(0, count);
                      });
                      setDuplicateWindows((prev) => {
                        const template =
                          prev[0] ?? {
                            parent: {
                              width: String(item.width),
                              height: String(item.height),
                            },
                            sections: (item.subItems ?? []).map((subItem) => ({
                              width: String(subItem.width),
                              height: String(subItem.height),
                            })),
                          };

                        return Array.from({ length: count }, () => ({
                          parent: {
                            ...template.parent,
                          },
                          sections: template.sections.map((section) => ({
                            ...section,
                          })),
                        }));
                      });

                      setDuplicateError("");
                      setDuplicateStep(2);
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={confirmDuplicate}
                    disabled={isMutating}
                    className="bg-[#0F172A] hover:bg-[#0F172A]"
                  >
                    {isMutating ? "Saving..." : "Duplicate"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// function for drag and drop
function SortableItem({
  item,
  index,
  configuratorBasePath,
  onDeleteItem,
  onDuplicateItem,
}: {
  item: QuotationItem;
  index: number;
  configuratorBasePath: string;
  onDeleteItem: (item: QuotationItem) => Promise<void>;
  onDuplicateItem: (
    item: QuotationItem,
    refCode: string,
    dimensions?: {
      parent: {
        width: string;
        height: string;
      };
      sections: {
        width: string;
        height: string;
      }[];
    }
  ) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard
        item={item}
        index={index}
        configuratorBasePath={configuratorBasePath}
        onDeleteItem={onDeleteItem}
        onDuplicateItem={onDuplicateItem}
      />
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
function ItemTab({
  quotationBasePath,
  onDeleteItem,
  onDuplicateItem,
  onReorderItems,
}: {
  quotationBasePath: string;
  onDeleteItem: (item: QuotationItem) => Promise<void>;
  onDuplicateItem: (
    item: QuotationItem,
    refCode: string,
    dimensions?: {
      parent: {
        width: string;
        height: string;
      };
      sections: {
        width: string;
        height: string;
      }[];
    }
  ) => Promise<void>;
  onReorderItems: (startIndex: number, endIndex: number) => Promise<void>;
}) {
  const quotation = useQuotationBuilderStore((state) => state.quotation);
  const items = quotation.items;
  const ITEMS_PER_PAGE = 30;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = items.slice(startIndex, endIndex);
  const setQuotation = useQuotationBuilderStore((state) => state.setQuotation);
  const router = useRouter();
  const profit = Number(quotation.breakdown?.profitPercentage) || 0;
  const [profitInput, setProfitInput] = useState(String(profit));
  const configuratorBasePath = `${quotationBasePath}/configurator`;
  const [optimizedFinal, setOptimizedFinal] = useState<number | null>(null);
  const [isCalculatingOptimizedFinal, setIsCalculatingOptimizedFinal] = useState(false);
  const [optimizedFinalError, setOptimizedFinalError] = useState("");
  const summaryColumnRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryPosition, setSummaryPosition] = useState({
    fixed: false,
    left: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateSummaryPosition = () => {
      const column = summaryColumnRef.current;
      const summary = summaryRef.current;
      if (!column || !summary) return;

      const columnRect = column.getBoundingClientRect();
      const shouldFix = window.matchMedia("(min-width: 1024px)").matches && columnRect.top <= 16;
      const nextPosition = {
        fixed: shouldFix,
        left: columnRect.left,
        width: columnRect.width,
        height: summary.getBoundingClientRect().height,
      };

      setSummaryPosition((current) =>
        current.fixed === nextPosition.fixed &&
        Math.abs(current.left - nextPosition.left) < 0.5 &&
        Math.abs(current.width - nextPosition.width) < 0.5 &&
        Math.abs(current.height - nextPosition.height) < 0.5
          ? current
          : nextPosition
      );
    };

    updateSummaryPosition();
    window.addEventListener("scroll", updateSummaryPosition, { passive: true });
    window.addEventListener("resize", updateSummaryPosition);
    const observer = new ResizeObserver(updateSummaryPosition);
    if (summaryColumnRef.current) observer.observe(summaryColumnRef.current);

    return () => {
      window.removeEventListener("scroll", updateSummaryPosition);
      window.removeEventListener("resize", updateSummaryPosition);
      observer.disconnect();
    };
  }, []);

  const totalQuantity = items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
  const totalArea = items.reduce((sum, item) =>
    sum + (item.area || 0) * Math.max(1, item.quantity || 1), 0);
  const totalAmount = items.reduce((sum, item) => {
    const area = item.area || 0;
    const rate = item.rate || 0;
    const qty = item.quantity || 1;
    let amount = area * rate * qty;
    //  Arch charge
    if (
      item?.systemType?.toLowerCase() === "casement" &&
      item?.archType &&
      item.archType !== "none"
    ) {
      amount += 5000;
    }
    return sum + amount;
  }, 0);
  const additionalCosts = quotation.globalConfig?.additionalCosts;
  const installationCost = additionalCosts?.showInstallation === false
    ? 0
    : totalArea * (Number(additionalCosts?.installation) || 0);
  const transportCost = additionalCosts?.showTransport === false
    ? 0
    : Number(additionalCosts?.transport) || 0;
  const loadingUnloadingCost = additionalCosts?.showLoadingUnloading === false
    ? 0
    : Number(additionalCosts?.loadingUnloading) || 0;
  const totalAdditionalCosts = installationCost + transportCost + loadingUnloadingCost;
  const totalCost = totalAmount + totalAdditionalCosts;
  const finalAmount = totalCost + (totalCost * profit) / 100;
  const priceBeforeDiscount = optimizedFinal === null
    ? finalAmount
    : optimizedFinal + totalAdditionalCosts;
  const discountPercent = additionalCosts?.showDiscount === false
    ? 0
    : Number(additionalCosts?.discountPercent) || 0;
  const discountAmount = (priceBeforeDiscount * discountPercent) / 100;
  const finalWithGSTBase = priceBeforeDiscount - discountAmount;
  const finalWithGST = finalWithGSTBase + (finalWithGSTBase * 18) / 100;
  const ratePerSqft = totalArea > 0 ? finalWithGST / totalArea : 0;
  useEffect(() => {
    setOptimizedFinal(null);
    setOptimizedFinalError("");
  }, [items, profit]);

  const calculateOptimizedFinal = async () => {
    const quotationId = getQuotationIdentity(quotation);
    if (!quotationId) {
      setOptimizedFinalError("Save the quotation before calculating the optimized final.");
      return;
    }
    setIsCalculatingOptimizedFinal(true);
    setOptimizedFinalError("");
    try {
      const result = await getOptimizedFinal(quotationId);
      setOptimizedFinal(Number(result.optimizedFinal) || 0);
    } catch (error) {
      console.error("Failed to calculate optimized final", error);
      setOptimizedFinalError("Unable to calculate optimized final.");
    } finally {
      setIsCalculatingOptimizedFinal(false);
    }
  };
  const updateProfit = (nextProfit: number) => {
    const safeProfit = Number.isFinite(nextProfit) ? nextProfit : 0;
    const nextFinalAmount = totalCost + (totalCost * safeProfit) / 100;
    const nextFinalWithGST = nextFinalAmount + (nextFinalAmount * 18) / 100;

    setQuotation({
      ...quotation,
      breakdown: {
        ...quotation.breakdown,
        totalAmount: nextFinalWithGST,
        profitPercentage: safeProfit,
      },
    });
  };

  // const handleAddItem = () => {
  //   const newItemId = crypto.randomUUID();
  //   router.push(`${configuratorBasePath}/${newItemId}`);
  // };
  // for reorder item 
  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    try {
      await onReorderItems(oldIndex, newIndex);
    } catch (error) {
      console.error("Failed to reorder quotation items", error);
    }
  };

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">


                {currentItems.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    configuratorBasePath={configuratorBasePath}
                    onDeleteItem={onDeleteItem}
                    onDuplicateItem={onDuplicateItem}
                  />
                ))}
              </div>
            </div>
            {/* QUOTATION SUMMARY */}
            <div
              ref={summaryColumnRef}
              className="min-w-0 lg:col-span-1"
              style={summaryPosition.fixed ? { minHeight: summaryPosition.height } : undefined}
            >
              <div
                ref={summaryRef}
                className={summaryPosition.fixed ? "fixed top-4 z-40" : "w-full"}
                style={
                  summaryPosition.fixed
                    ? { left: summaryPosition.left, width: summaryPosition.width }
                    : undefined
                }
              >
                <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-lg">
                  <div className="mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white">
                      Quotation Summary
                    </h3>
                  </div>

                  <div className="space-y-4">

                    {/* Quantity */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">◈</span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          Quantity
                        </span>
                      </div>

                      <span className="text-sm font-semibold">
                        {totalQuantity}
                      </span>
                    </div>

                    {/* Area */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">↗</span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          Area
                        </span>
                      </div>

                      <span className="text-sm font-semibold">
                        {formatNumber(totalArea)}{" "}
                        <span className="text-[9px] font-normal text-slate-500">
                          sqft
                        </span>
                      </span>
                    </div>

                    {/* Total Cost */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">▣</span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          Total Cost
                        </span>
                      </div>

                      <span className="text-sm font-semibold">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>

                    {/* Profit */}
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400">⌁</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                          Profit
                        </span>
                      </div>
                      <div className="flex items-center gap-2">

                        <input
                          type="text"
                          inputMode="decimal"
                          value={profitInput}
                          onChange={(e) => {
                            const value = e.target.value;

                            if (!/^\d*(?:\.\d*)?$/.test(value)) return;

                            setProfitInput(value);
                            updateProfit(
                              value.trim() === "" ? 0 : Number(value)
                            );
                          }}
                          className="h-7 w-12 rounded-md border border-slate-700 bg-slate-900 px-2 text-center text-xs text-white outline-none focus:border-slate-500"
                        />

                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>

                    {/* Selling Price */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">◇</span>
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
                            Selling Price
                          </div>
                        </div>
                      </div>

                      <span className="text-sm font-semibold">
                        {formatCurrency(finalAmount)}
                      </span>
                    </div>

                    {/* Customer Price */}
                    <div className="rounded-xl bg-slate-900 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-red-500">♧</span>

                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-red-500">
                            Customer Price
                          </div>
                        </div>
                      </div>

                      <div className="mt-1 text-lg font-bold text-red-500">
                        {formatCurrency(finalWithGST)}
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-slate-400">▣</span>

                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Rate:
                        </span>

                        <span className="text-xs font-semibold text-slate-300">
                          {formatCurrency(ratePerSqft)} / SQFT
                        </span>
                      </div>
                    </div>



                  </div>
                </div>

              </div>
            </div>


          </div>
          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>

            <span className="px-4 py-2">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>

        </SortableContext>
      </DndContext>
    </div>
  );
}
function CustomerTab({ onSave, isSaving }: { onSave: () => Promise<void>; isSaving: boolean }) {
  const customer = useQuotationBuilderStore((state) => state.quotation.customerDetails);
  const updateCustomer = useQuotationBuilderStore((state) => state.updateCustomer);
  const quotationDetails = useQuotationBuilderStore((s) => s.quotation.quotationDetails);
  const updateQuotationField = useQuotationBuilderStore((s) => s.updateQuotationField);
  const customerValues = customer ?? {
    name: "",
    phone: "",
    email: "",
    address: "",
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
        className="mb-5 flex w-full items-start justify-between text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <UserRound className="h-4 w-4 text-slate-600" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Customer Profile
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Manage the primary contact and billing address for this quotation.
            </p>
          </div>
        </div>

        <span className="pt-1 text-sm text-slate-950">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 border-t border-slate-100 pt-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

            <div>
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                Contact Information
              </h3>

              <div className="space-y-4">


                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">
                    Full Name
                  </label>

                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={customerValues.name}
                      onChange={(e) =>
                        updateCustomer("name", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>


                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">
                    Email Address
                  </label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="email"
                      value={customerValues.email}
                      onChange={(e) =>
                        updateCustomer("email", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>


                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">
                    Phone Number
                  </label>

                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="tel"
                      value={customerValues.phone}
                      onChange={(e) =>
                        updateCustomer("phone", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>

              </div>
            </div>


            <div>
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                Billing Address
              </h3>

              <div className="space-y-4">


                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">
                    Street Address
                  </label>

                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <textarea
                      value={customerValues.address}
                      onChange={(e) =>
                        updateCustomer("address", e.target.value)
                      }
                      rows={1}
                      className="min-h-[44px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>


                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">


                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-700">
                      City
                    </label>

                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="text"
                        value={customerValues.city || ""}
                        onChange={(e) =>
                          updateCustomer("city", e.target.value)
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                      />
                    </div>
                  </div>


                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-700">
                      State
                    </label>

                    <div className="relative">
                      <MapPinned className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="text"
                        value={customerValues.state || ""}
                        onChange={(e) =>
                          updateCustomer("state", e.target.value)
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                      />
                    </div>
                  </div>

                </div>


                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-700">
                    PIN Code
                  </label>

                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={customerValues.pincode || ""}
                      onChange={(e) =>
                        updateCustomer("pincode", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>
          <div className=" mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2 flex items-center gap-3">
              <FileText className="h-7 w-7 text-slate-400" />

              <h2 className="text-base font-semibold text-slate-900">
                Quotation Details
              </h2>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={quotationDetails.date || ""}
                onChange={(e) =>
                  updateQuotationField("date", e.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
              />
            </div>


            <div>
              <label className="mb-2 block text-xs font-medium text-slate-700">
                Opportunity Stage
              </label>

              <div className="relative">
                <CustomSelect
                  value={quotationDetails.opportunity || "Enquiry"}
                  onChange={(e) =>
                    updateQuotationField("opportunity", e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
                >
                  <option value="Enquiry">Enquiry</option>
                  <option value="Quoted">Quoted</option>
                  <option value="Under Negotiation">Under Negotiation</option>
                  <option value="Order Confirmed">Order Confirmed</option>
                  <option value="Order Lost">Order Lost</option>
                </CustomSelect>

              </div>
            </div>

          </div>
        </div>

      )}




      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={() => void onSave()} disabled={isSaving} className="bg-slate-950 text-white hover:bg-slate-950">
          {isSaving ? "Saving..." : "Save Details"}
        </Button>
      </div>

    </div>


  );

}
function GlobalConfigTab({ globalConfig,
  setGlobalConfig,
  logoPreview,
  handleLogoUpload,
  onSave,
  isSaving,
}: any) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-6 flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <Settings2 className="h-4 w-4 text-slate-600" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Global Configuration
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Manage global settings used across this quotation.
            </p>
          </div>
        </div>

        <span className="text-sm text-slate-950">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <>

          <div className="mb-5 flex justify-end">
            <a
              href="/quotations/settings"
              className="text-0.5xl font-medium text-slate-500 transition hover:text-[#0F172A]"
            >
              Manage Presets
            </a>
          </div>

          <div className="border-t border-slate-100 pt-6">

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-7">
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />

                    <h3 className="text-0.5xl font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Brand Identity
                    </h3>
                  </div>

                  <div className="space-y-5">


                    <div>
                      <label className="mb-2 block text-0.5xl font-medium text-slate-700">
                        Company Logo
                      </label>

                      <div className="flex items-center gap-4">

                        {logoPreview ? (
                          <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <img
                              src={logoPreview}
                              alt="Company Logo"
                              className="max-h-12 max-w-[72px] object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                            <ImageIcon className="h-5 w-5 text-slate-400" />
                          </div>
                        )}

                        <div className="flex items-center gap-2">

                          <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-[#0F172A] hover:text-[#0F172A]">
                            <span className="flex items-center gap-2">
                              <Upload className="h-3.5 w-3.5" />
                              Choose File
                            </span>

                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) =>
                                handleLogoUpload(e.target.files?.[0] || null)
                              }
                            />
                          </label>

                          {logoPreview && (
                            <button
                              type="button"
                              onClick={() =>
                                setGlobalConfig((p: any) => ({
                                  ...p,
                                  logo: "",
                                  logoUrl: "",
                                }))
                              }
                              className="rounded-lg px-2 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50"
                            >
                              <span className="flex items-center gap-1.5">
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </span>
                            </button>
                          )}

                        </div>
                      </div>
                    </div>


                    <div>
                      <label className="mb-2 block text-0.5xl font-medium text-slate-700">
                        Website URL
                      </label>

                      <input
                        value={globalConfig.website}
                        onChange={(e) =>
                          setGlobalConfig((p: any) => ({
                            ...p,
                            website: e.target.value,
                          }))
                        }
                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                      />
                    </div>

                  </div>
                </div>


                <div className="border-t border-slate-100 pt-6">

                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />

                    <h3 className="text-0.5xl font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Document Content
                    </h3>
                  </div>

                  <div className="space-y-5">

                    <div>
                      <label className="mb-2 block text-0.5xl font-medium text-slate-700">
                        Prerequisites
                      </label>

                      <textarea
                        value={globalConfig.prerequisites}
                        onChange={(e) =>
                          setGlobalConfig((p: any) => ({
                            ...p,
                            prerequisites: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-0.5xl font-medium text-slate-700">
                        Terms & Conditions
                      </label>

                      <textarea
                        value={globalConfig.terms}
                        onChange={(e) =>
                          setGlobalConfig((p: any) => ({
                            ...p,
                            terms: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-0.5xl font-medium text-slate-700">Payment Info</label>
                      <textarea
                        value={globalConfig.paymentInfo}
                        onChange={(e) =>
                          setGlobalConfig((p: any) => ({
                            ...p,
                            paymentInfo: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                      />
                    </div>

                  </div>
                </div>

              </div>
              <div>
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5 text-slate-500" />

                      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                        Additional Costs
                      </h3>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Toggle "PDF" to show on quotation
                    </span>
                  </div>

                  <div className="space-y-5">

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-0.5xl font-medium text-slate-700">
                          Installation (₹/sqft)
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={
                              globalConfig.additionalCosts.showInstallation ??
                              true
                            }
                            onChange={(e) =>
                              setGlobalConfig((p: any) => ({
                                ...p,
                                additionalCosts: {
                                  ...p.additionalCosts,
                                  showInstallation: e.target.checked,
                                },
                              }))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
                          />
                          Show in PDF
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
                          className="h-10 w-[138px]  rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-0.5xl font-medium text-slate-700">
                          Transport ( ₹)
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={
                              globalConfig.additionalCosts.showTransport ??
                              true
                            }
                            onChange={(e) =>
                              setGlobalConfig((p: any) => ({
                                ...p,
                                additionalCosts: {
                                  ...p.additionalCosts,
                                  showTransport: e.target.checked,
                                },
                              }))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
                          />
                          Show in PDF
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
                          className="h-10 w-[138px]  rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-0.5xl font-medium text-slate-700">
                          Loading & Unloading (₹)
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={
                              globalConfig.additionalCosts
                                .showLoadingUnloading ?? true
                            }
                            onChange={(e) =>
                              setGlobalConfig((p: any) => ({
                                ...p,
                                additionalCosts: {
                                  ...p.additionalCosts,
                                  showLoadingUnloading: e.target.checked,
                                },
                              }))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
                          />
                          Show in PDF
                        </label>

                        <input
                          type="number"
                          value={
                            globalConfig.additionalCosts.loadingUnloading
                          }
                          onChange={(e) =>
                            setGlobalConfig((p: any) => ({
                              ...p,
                              additionalCosts: {
                                ...p.additionalCosts,
                                loadingUnloading:
                                  Number(e.target.value) || 0,
                              },
                            }))
                          }
                          className="h-10 w-[138px]  rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                        />
                      </div>
                    </div>


                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-0.5xl font-medium text-slate-700">
                          Discount (%)
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={
                              globalConfig.additionalCosts.showDiscount ??
                              true
                            }
                            onChange={(e) =>
                              setGlobalConfig((p: any) => ({
                                ...p,
                                additionalCosts: {
                                  ...p.additionalCosts,
                                  showDiscount: e.target.checked,
                                },
                              }))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
                          />
                          Show in PDF
                        </label>

                        <input
                          type="number"
                          value={
                            globalConfig.additionalCosts.discountPercent
                          }
                          onChange={(e) =>
                            setGlobalConfig((p: any) => ({
                              ...p,
                              additionalCosts: {
                                ...p.additionalCosts,
                                discountPercent:
                                  Number(e.target.value) || 0,
                              },
                            }))
                          }
                          className="h-10 w-[138px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]"
                        />
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

      {/* SAVE */}
      <div className="mt-7 flex justify-end border-t border-slate-100 pt-5">
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving}
          className="rounded-lg bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-950"
        >
          {isSaving ? "Saving..." : "Save Global Configuration"}
        </Button>
      </div>

    </div>


  );
}

type BulkUpdateField = "glass" | "colorFinish";

const collectUsedBulkOptions = (
  items: QuotationItem[],
  field: BulkUpdateField
) => {
  const property = field === "glass" ? "glassSpec" : "colorFinish";
  const values = new Set<string>();
  const collect = (item: QuotationItem) => {
    const value = String(item[property] || "").trim();
    if (value) values.add(value);
    item.subItems?.forEach((subItem) => collect(subItem as QuotationItem));
  };
  items.forEach(collect);
  return Array.from(values).sort((a, b) => a.localeCompare(b));
};

function BulkUpdateTab({
  quotation,
  onApply,
  isSaving,
}: {
  quotation: Quotation;
  onApply: (
    field: BulkUpdateField,
    from: string,
    to: string
  ) => Promise<number>;
  isSaving: boolean;
}) {
  const [field, setField] = useState<BulkUpdateField>("glass");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const optionsQuery = useQuery({
    queryKey: ["quotation-options", "bulk-update"],
    queryFn: () => fetchOptions(""),
  });
  const usedOptions = useMemo(
    () => collectUsedBulkOptions(quotation.items, field),
    [field, quotation.items]
  );
  const replacementOptions = useMemo(() => {
    const source =
      field === "glass"
        ? optionsQuery.data?.glassSpecs
        : optionsQuery.data?.colorFinishes;
    return Array.from(
      new Set((source || []).map((option) => option.name.trim()).filter(Boolean))
    )
      .filter((option) => option !== from)
      .sort((a, b) => a.localeCompare(b));
  }, [field, from, optionsQuery.data]);

  const selectField = (next: BulkUpdateField) => {
    setField(next);
    setFrom("");
    setTo("");
    setMessage("");
  };

  const applyUpdate = async () => {
    setMessage("");
    try {
      const count = await onApply(field, from, to);
      setMessage(
        `${count} item${count === 1 ? "" : "s"} updated successfully.`
      );
      setFrom("");
      setTo("");
      window.location.reload();
    } catch (error) {
      console.error("Bulk quotation update failed", error);
      setMessage(
        error instanceof Error ? error.message : "Bulk update failed."
      );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Bulk Update</h2>
        <p className="mt-1 text-sm text-slate-500">
          Replace a glass specification or colour finish everywhere it is used
          in this quotation.
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          What to update
          <CustomSelect
            value={field}
            onChange={(event) =>
              selectField(event.target.value as BulkUpdateField)
            }
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
          >
            <option value="glass">Glass</option>
            <option value="colorFinish">Colour Finish</option>
          </CustomSelect>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Replace
          <CustomSelect
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setTo("");
              setMessage("");
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
          >
            <option value="">Select an option used in this quotation</option>
            {usedOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </CustomSelect>
          {!usedOptions.length ? (
            <span className="mt-2 block text-xs font-normal text-amber-700">
              No {field === "glass" ? "glass specifications" : "colour finishes"} are used yet.
            </span>
          ) : null}
        </label>

        <label className="text-sm font-medium text-slate-700">
          Replace with
          <CustomSelect
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setMessage("");
            }}
            disabled={!from || optionsQuery.isLoading}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 shadow-sm transition-all focus:outline-none focus:border-[#124657] focus:ring-2 focus:ring-[#124657]"
          >
            <option value="">
              {optionsQuery.isLoading ? "Loading options..." : "Select replacement"}
            </option>
            {replacementOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </CustomSelect>
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="text-sm text-slate-600">
          {message ||
            (from
              ? `${quotation.items.length} quotation item${quotation.items.length === 1 ? "" : "s"} will be checked.`
              : "")}
        </div>
        <Button
          type="button"
          onClick={() => void applyUpdate()}
          disabled={!from || !to || isSaving}
          className="bg-slate-950 text-white hover:bg-slate-950"
        >
          {isSaving ? "Saving..." : "Save Bulk Update"}
        </Button>
      </div>
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
  const searchParams = useSearchParams();
  const isCreateMode = quotationBasePath === "/quotations/new";
  const setQuotation = useQuotationBuilderStore((state) => state.setQuotation);
  const applyAutosaveResult = useQuotationBuilderStore((state) => state.applyAutosaveResult);
  const updateGlobalConfig = useQuotationBuilderStore((state) => state.updateGlobalConfig);
  const markSaved = useQuotationBuilderStore((state) => state.markSaved);
  const { quotation, saveState } = useQuotationBuilder();
  const metadataSaveChainRef = useRef<Promise<Quotation | null>>(Promise.resolve(null));
  const lastPersistedMetadataFingerprintRef = useRef<string | null>(null);
  const itemMutationChainRef = useRef<Promise<void>>(Promise.resolve());
  const [itemMutationsInProgress, setItemMutationsInProgress] = useState(0);
  const [metadataSaveStatus, setMetadataSaveStatus] = useState<"idle" | "saving" | "failed">("idle");
  const requestedTab = searchParams.get("tab");
  const isReturningFromConfigurator = isCreateMode && requestedTab === "item";
  const router = useRouter();
  const configuratorBasePath = `${quotationBasePath}/configurator`;
  const [globalConfig, setGlobalConfig] = useState(createBuilderGlobalConfig);
  const [isGlobalConfigLoaded, setIsGlobalConfigLoaded] = useState(false);
  const hydratedQuotationKeyRef = useRef<string | null>(null);
  const hydratedGlobalConfigKeyRef = useRef<string | null>(null);
  const persistedBaselineKeyRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleAddItem = () => {
    router.push(`${configuratorBasePath}/${crypto.randomUUID()}?mode=create`);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await loadGlobalConfig();
        if (!data) return;

        const currentQuotation = useQuotationBuilderStore.getState().quotation;
        const savedConfig = currentQuotation._id ? currentQuotation.globalConfig : undefined;
        const useSavedOverride = savedConfig?.isOverridden === true;

        setGlobalConfig({
          ...createBuilderGlobalConfig(),
          ...data,
          ...(useSavedOverride ? savedConfig : {}),
          isOverridden: useSavedOverride,
          logoUrl: (useSavedOverride ? savedConfig?.logo : data.logo) || "",
          logo: (useSavedOverride ? savedConfig?.logo : data.logo) || "",
          website: (useSavedOverride ? savedConfig?.website : data.website) || "",
          terms: (useSavedOverride ? savedConfig?.terms : data.terms) || "",
          prerequisites: (useSavedOverride ? savedConfig?.prerequisites : data.prerequisites) || "",
          paymentInfo: (useSavedOverride ? savedConfig?.paymentInfo : data.paymentInfo) || "",
          additionalCosts: {
            ...createBuilderGlobalConfig().additionalCosts,
            ...data.additionalCosts,
            ...(useSavedOverride ? savedConfig?.additionalCosts : {}),
          },
        });
      } catch (error) {
        console.error("Failed to load global quotation configuration", error);
      } finally {
        setIsGlobalConfigLoaded(true);
      }
    };

    void fetchData();
  }, []);
  useEffect(() => {
    if (isCreateMode) {
      if (isReturningFromConfigurator) {
        return;
      }
      setQuotation(initialQuotation ?? createEmptyQuotation());
      hydratedQuotationKeyRef.current = null;
      return;
    }

    if (!initialQuotation) return;

    const nextQuotationKey = getQuotationIdentity(initialQuotation);
    if (hydratedQuotationKeyRef.current !== nextQuotationKey) {
      hydratedQuotationKeyRef.current = nextQuotationKey;
      hydratedGlobalConfigKeyRef.current = null;
      lastPersistedMetadataFingerprintRef.current = getQuotationMetadataSaveFingerprint(initialQuotation);
      if (quotation._id !== initialQuotation._id) {
        setQuotation(initialQuotation);
      }
    }
  }, [initialQuotation, isCreateMode, isReturningFromConfigurator, setQuotation]);
  const [activeTab, setActiveTab] = useState<TabKey>(() => (isTabKey(requestedTab) ? requestedTab : "Details"));
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingCuttingSchedule, setIsGeneratingCuttingSchedule] = useState(false);
  const [isGeneratingBom, setIsGeneratingBom] = useState(false);
  const [isGeneratingGlassReport, setIsGeneratingGlassReport] = useState(false);
  const [isGeneratingElevation, setIsGeneratingElevation] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isSharingQuotation, setIsSharingQuotation] = useState(false);
  const [isExcelExportModalOpen, setIsExcelExportModalOpen] = useState(false);
  const [activeExport, setActiveExport] = useState<
    "cutting" | "bom" | "glass" | "quotation" | "elevation" | "excel" | null
  >(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfDirectDownloadUrl, setPdfDirectDownloadUrl] = useState<string | null>(null);
  const [pdfPreparationStatus, setPdfPreparationStatus] = useState<"idle" | "preparing" | "ready" | "failed">("idle");
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState("Quotation PDF Preview");
  const [pdfDownloadName, setPdfDownloadName] = useState("");
  const [bomOrderData, setBomOrderData] = useState<BomOrderData | null>(null);
  const [isOrderPlacementOpen, setIsOrderPlacementOpen] = useState(false);

  useEffect(() => {
    const isAnyGenerationInProgress =
      isGeneratingCuttingSchedule ||
      isGeneratingBom ||
      isGeneratingGlassReport ||
      isGeneratingPdf ||
      isGeneratingElevation ||
      isGeneratingExcel;

    if (!isAnyGenerationInProgress) {
      setActiveExport(null);
    }
  }, [
    isGeneratingCuttingSchedule,
    isGeneratingBom,
    isGeneratingGlassReport,
    isGeneratingPdf,
    isGeneratingElevation,
    isGeneratingExcel,
  ]);
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);
  useEffect(() => {
    const quotationId = initialQuotation?._id;
    if (isCreateMode || !quotationId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const result = await getQuotationPdfStatus(quotationId);
        if (cancelled) return;
        if (result.status === "ready") {
          setPdfPreparationStatus("ready");
          return;
        }
        if (result.status === "failed") {
          setPdfPreparationStatus("failed");
          return;
        }
        setPdfPreparationStatus("preparing");
        attempts += 1;
        if (attempts < 60) timer = setTimeout(checkStatus, 1000);
      } catch (error) {
        console.warn("Unable to read quotation PDF preparation status", error);
        if (!cancelled) setPdfPreparationStatus("idle");
      }
    };

    void checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [initialQuotation?._id, initialQuotation?.updatedAt, isCreateMode]);
  useEffect(() => {
    if (!isTabKey(requestedTab)) return;
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const logoPreview = globalConfig.logoUrl || globalConfig.logo;
  const quotationWithGlobalConfig = useMemo(
    () => ({
      ...quotation,
      globalConfig: {
        isOverridden: globalConfig.isOverridden,
        logo: globalConfig.logo || "",
        website: globalConfig.website || "",
        terms: globalConfig.terms || "",
        prerequisites: globalConfig.prerequisites || "",
        paymentInfo: globalConfig.paymentInfo || "",
        additionalCosts: {
          installation: Number(globalConfig.additionalCosts.installation) || 0,
          transport: Number(globalConfig.additionalCosts.transport) || 0,
          loadingUnloading: Number(globalConfig.additionalCosts.loadingUnloading) || 0,
          discountPercent: Number(globalConfig.additionalCosts.discountPercent) || 0,
          showInstallation: globalConfig.additionalCosts.showInstallation ?? true,
          showTransport: globalConfig.additionalCosts.showTransport ?? true,
          showLoadingUnloading: globalConfig.additionalCosts.showLoadingUnloading ?? true,
          showDiscount: globalConfig.additionalCosts.showDiscount ?? true,
        },
      },
    }),
    [globalConfig, quotation]
  );

  useEffect(() => {
    if (isCreateMode || !isGlobalConfigLoaded || !initialQuotation?._id) return;

    const baselineKey = getQuotationIdentity(initialQuotation);
    if (persistedBaselineKeyRef.current === baselineKey) return;

    persistedBaselineKeyRef.current = baselineKey;
    lastPersistedMetadataFingerprintRef.current = getQuotationMetadataSaveFingerprint({
      ...initialQuotation,
      globalConfig: quotationWithGlobalConfig.globalConfig,
    });
    markSaved();
  }, [
    initialQuotation,
    isCreateMode,
    isGlobalConfigLoaded,
    markSaved,
    quotationWithGlobalConfig.globalConfig,
  ]);

  const saveMetadata = useCallback(
    (snapshot: Quotation) => {
      const persist = async () => {
        const currentQuotation = useQuotationBuilderStore.getState().quotation;
        const quotationToSave = snapshot._id
          ? snapshot
          : { ...snapshot, _id: currentQuotation._id };

        setMetadataSaveStatus("saving");
        try {
          const saved = await saveQuotationMetadata(quotationToSave);
          if (!saved) throw new Error("Saving quotation details returned no quotation");
          console.log("Saved Response:", saved.globalConfig);
          console.log("Saved Response:", JSON.stringify(saved.globalConfig, null, 2));

          applyAutosaveResult(snapshot, saved);
          lastPersistedMetadataFingerprintRef.current = getQuotationMetadataSaveFingerprint(saved);
          markSaved();

          const snapshotLogo = snapshot.globalConfig?.logo || "";
          const savedLogo = saved.globalConfig?.logo || "";
          if (savedLogo && savedLogo !== snapshotLogo) {
            setGlobalConfig((current) =>
              (current.logo || "") === snapshotLogo
                ? { ...current, logo: savedLogo, logoUrl: savedLogo }
                : current
            );
          }

          setMetadataSaveStatus("idle");
          return saved;
        } catch (error) {
          setMetadataSaveStatus("failed");
          throw error;
        }
      };

      metadataSaveChainRef.current = metadataSaveChainRef.current
        .catch(() => null)
        .then(persist);
      return metadataSaveChainRef.current;
    },
    [applyAutosaveResult, markSaved]
  );

  const saveCurrentMetadata = useCallback(async () => {
    const current = useQuotationBuilderStore.getState().quotation;
    const snapshot = {
      ...current,
      globalConfig: quotationWithGlobalConfig.globalConfig,
    };
    const saved = await saveMetadata(snapshot);
    if (saved?._id && isCreateMode) {
      router.replace(`/quotations/${saved._id}?tab=${activeTab}`);
    }
  }, [activeTab, isCreateMode, quotationWithGlobalConfig.globalConfig, router, saveMetadata]);

  const saveQuotationGlobalOverride = useCallback(async () => {
    const overriddenGlobalConfig = {
      ...quotationWithGlobalConfig.globalConfig,
      isOverridden: true,
    };
    setGlobalConfig((current) => ({ ...current, isOverridden: true }));
    const current = useQuotationBuilderStore.getState().quotation;
    const saved = await saveMetadata({
      ...current,
      globalConfig: overriddenGlobalConfig,
    });
    if (saved?._id && isCreateMode) {
      router.replace(`/quotations/${saved._id}?tab=${activeTab}`);
    }
  }, [activeTab, isCreateMode, quotationWithGlobalConfig.globalConfig, router, saveMetadata]);

  const getPersistedQuotation = useCallback(async () => {
    await itemMutationChainRef.current;
    await metadataSaveChainRef.current.catch(() => null);
    const current = useQuotationBuilderStore.getState().quotation;
    const snapshot = {
      ...current,
      globalConfig: quotationWithGlobalConfig.globalConfig,
    };

    if (
      current._id &&
      lastPersistedMetadataFingerprintRef.current === getQuotationMetadataSaveFingerprint(snapshot)
    ) {
      return current;
    }

    const saved = await saveMetadata(snapshot);
    return saved ?? useQuotationBuilderStore.getState().quotation;
  }, [quotationWithGlobalConfig.globalConfig, saveMetadata]);

  const runItemMutation = useCallback((mutation: () => Promise<void>) => {
    setItemMutationsInProgress((count) => count + 1);
    const operation = itemMutationChainRef.current
      .catch(() => undefined)
      .then(mutation);
    itemMutationChainRef.current = operation.then(
      () => undefined,
      () => undefined
    );
    return operation.finally(() => {
      setItemMutationsInProgress((count) => Math.max(0, count - 1));
    });
  }, []);

  const ensureParentQuotation = useCallback(async () => {
    const current = useQuotationBuilderStore.getState().quotation;
    if (current._id) return current._id;
    const snapshot = {
      ...current,
      globalConfig: quotationWithGlobalConfig.globalConfig,
    };
    const saved = await saveQuotationMetadata(snapshot);
    if (!saved?._id) throw new Error("Creating the quotation returned no id");
    applyAutosaveResult(snapshot, saved);
    markSaved();
    return saved._id;
  }, [applyAutosaveResult, markSaved, quotationWithGlobalConfig.globalConfig]);

  const persistDeleteItem = useCallback(
    (item: QuotationItem) =>
      runItemMutation(async () => {
        const itemId = getServerQuotationItemId(item);
        const localId = getQuotationItemIdentity(item);
        const quotationId = await ensureParentQuotation();
        if (itemId) await deleteQuotationItem(quotationId, itemId);
        useQuotationBuilderStore.getState().removeItem(localId);
        markSaved();
      }),
    [ensureParentQuotation, markSaved, runItemMutation]
  );

  // const persistDuplicateItem = useCallback(
  //   (item: QuotationItem, refCode: string) =>
  const persistDuplicateItem = useCallback(
    (
      item: QuotationItem,
      refCode: string,
      dimensions?: {
        parent: {
          width: string;
          height: string;
        };
        sections: {
          width: string;
          height: string;
        }[];
      }
    ) =>
      runItemMutation(async () => {
        const sourceId = getQuotationItemIdentity(item);
        const store = useQuotationBuilderStore.getState();
        // store.duplicateItem(sourceId, refCode);
        store.duplicateItem(sourceId, refCode, dimensions);
        const items = useQuotationBuilderStore.getState().quotation.items;
        const sourceIndex = items.findIndex(
          (entry) => getQuotationItemIdentity(entry) === sourceId
        );
        const ite = useQuotationBuilderStore.getState().quotation.items;

        console.log("ALL ITEMS =", ite);
        const duplicate = items[sourceIndex + 1];
        console.log("DUPLICATE =", duplicate);

        if (duplicate) {
          console.log("systemType =", duplicate.systemType);
          console.log("series =", duplicate.series);
          console.log("description =", duplicate.description);

          console.log("SUB ITEMS =", duplicate.subItems);
        }
        if (!duplicate) throw new Error("Failed to create the local duplicate");
        const layout = duplicate.configuratorLayout as {
          frameCutAngle?: "45" | "90";
          shutterCutAngle?: "45" | "90";
        };
        const duplicateLocalId = getQuotationItemIdentity(duplicate);
        const isCombinationItem = duplicate.systemType === "Combination" || (duplicate.subItems?.length ?? 0) > 1;
        try {
          const quotationId = await ensureParentQuotation();
          if (isCombinationItem) {
            const combinationSubItems = Array.isArray(duplicate.subItems) ? duplicate.subItems : [];
            if (combinationSubItems.length) {
              const rateInputs = combinationSubItems.map((subItem) => ({
                clientId: subItem.id,
                systemType: subItem.systemType || "",
                series: subItem.series || "",
                description: subItem.description || "",
                width: Number(subItem.width),
                height: Number(subItem.height),
                area: Number(subItem.area),
                frameCutAngle: subItem.frameCutAngle ?? layout.frameCutAngle ?? "45",
                shutterCutAngle: subItem.shutterCutAngle ?? layout.shutterCutAngle ?? "45",
                cuttingScheduleKey: subItem.cuttingScheduleKey || String(duplicate.cuttingScheduleKey || "45_45"),
                glassSpec: subItem.glassSpec || "",
                hardwareOpeningType: (subItem.hardwareOpeningType || "") as "" | "hinges" | "frictionStay",
              }));

              const [calculatedSubItemRates, ...rest] = await Promise.all([
                calculateQuotationRates(rateInputs),
                ...combinationSubItems.map(async (subItem) => {
                  const [descriptions, options] = await Promise.all([
                    fetchDescriptions(subItem.systemType || "", subItem.series || ""),
                    fetchOptions(subItem.systemType || ""),
                  ]);

                  return { subItem, descriptions, options };
                }),
              ]);
              const joinRequests = (duplicate.joins ?? [])
                .map((join, index) => ({
                  clientId: `__join__${index}`,
                  itemType: "join" as const,
                  joinType: join.type,
                  // joinOrientation: join.orientation,
                  systemType: duplicate.systemType,
                  series: duplicate.series,
                  description: join.type,
                  width: Number(duplicate.width),
                  height: Number(duplicate.height),
                  area: Number(duplicate.area),
                  frameCutAngle: duplicate.frameCutAngle,
                  shutterCutAngle: duplicate.shutterCutAngle,
                  cuttingScheduleKey: duplicate.cuttingScheduleKey,
                }))
                .filter((request) => request.series);

              const rateByClientId = new Map(
                calculatedSubItemRates.map((result) => [result.clientId, result])
              );

              duplicate.subItems = rest.map(({ subItem, descriptions, options }) => {
                const rateResult = rateByClientId.get(subItem.id);
                if (!rateResult) {
                  return subItem;
                }

                const matchedDescription = descriptions.descriptions.find(
                  (entry) => entry.name === subItem.description
                );
                const colorRate =
                  options?.colorFinishes.find((entry) => entry.name === subItem.colorFinish)?.rate ?? 0;
                const meshRate = subItem.meshPresent
                  ? options?.meshTypes.find((entry) => entry.name === subItem.meshType)?.rate ?? 0
                  : 0;
                const glassRate =
                  options?.glassSpecs.find((entry) => entry.name === subItem.glassSpec)?.rate ?? 0;
                const handleOption = options?.handleOptions.find(
                  (entry) => entry.name === subItem.handleType
                );
                const handleCount = matchedDescription?.defaultHandleCount ?? 0;
                const handleUnitRate =
                  handleOption?.colors.find((entry) => entry.name === subItem.handleColor)?.rate ?? 0;
                const handleRate =
                  handleCount > 0
                    ? (handleCount * handleUnitRate) / (Number(subItem.area) || 1)
                    : 0;
                const exhaustFanRate = subItem.hasExhaustFan ? EXHAUST_FAN_RATE_SURCHARGE : 0;
                const rate = Number(
                  (
                    (rateResult.baseRate ?? 0) +
                    colorRate +
                    meshRate +
                    glassRate +
                    handleRate +
                    exhaustFanRate
                  ).toFixed(2)
                );
                const amount = Number(
                  (
                    rate *
                    Number(subItem.area) *
                    Number(subItem.quantity || 1)
                  ).toFixed(2)
                );

                return {
                  ...subItem,
                  rate,
                  amount,
                };
              });

              const totalArea = Number(duplicate.area) || combinationSubItems.reduce((sum, subItem) => sum + Number(subItem.area || 0), 0);
              const totalAmount = duplicate.subItems.reduce((sum, subItem) => sum + Number(subItem.amount || 0), 0);
              duplicate.rate = Number((totalArea > 0 ? totalAmount / totalArea : 0).toFixed(2));
              console.log("COMBINATION TOTAL", {
                totalArea,
                totalAmount,
                finalRate: totalArea > 0 ? totalAmount / totalArea : 0,
              });
              duplicate.amount = Number(
                (
                  duplicate.rate *
                  Number(duplicate.area) *
                  Number(duplicate.quantity || 1)
                ).toFixed(2)
              );
            } else {
              duplicate.rate = Number(duplicate.rate) || 0;
              duplicate.amount = Number(
                (
                  Number(duplicate.rate) *
                  Number(duplicate.area) *
                  Number(duplicate.quantity || 1)
                ).toFixed(2)
              );
            }
            const savedItem = await createQuotationItem(quotationId, duplicate);
            useQuotationBuilderStore.getState().replaceItem(duplicateLocalId, savedItem);
            markSaved();
            return;
          }
          console.log("=== RATE API HIT HONE WALI HAI ===");
          console.log("Duplicate object:", duplicate);
          console.log("System Type:", duplicate?.systemType);
          console.log("Series:", duplicate?.series);
          console.log("Description:", duplicate?.description);
          const isCasement = duplicate.systemType === "Casement";
          const isLouver = duplicate.systemType === "Louvers" || duplicate.description === "Louvers";
          const frameCutAngle = isCasement
            ? "45"
            : (duplicate.frameCutAngle ?? layout.frameCutAngle ?? "90");
          const shutterCutAngle = isCasement
            ? "45"
            : (duplicate.shutterCutAngle ?? layout.shutterCutAngle ?? "90");
          const cuttingScheduleKey =
            duplicate.cuttingScheduleKey || `${frameCutAngle}_${shutterCutAngle}`;
          const hardwareOpeningType =
            isCasement
              ? ((duplicate.hardwareOpeningType || "") as "" | "hinges" | "frictionStay")
              : "";
          const [rateResult] = await calculateQuotationRates([
            {
              clientId: duplicate.id,

              systemType: duplicate.systemType || "",

              series: duplicate.series || "",

              description: duplicate.description || "",

              width: Number(duplicate.width),

              height: Number(duplicate.height),

              area: Number(duplicate.area),
              frameCutAngle,

              shutterCutAngle,

              cuttingScheduleKey,

              glassSpec: duplicate.glassSpec || "",

              hardwareOpeningType,
            },
          ]);

          console.log("RATE RESULT", rateResult);
          const [descriptions, options] = await Promise.all([
            fetchDescriptions(duplicate.systemType || "", isLouver ? "_" : (duplicate.series || "")),
            fetchOptions(duplicate.systemType || ""),
          ]);

          let desc: any = null;

          if (
            duplicate.systemType !== "Louvers" &&
            duplicate.description !== "Louvers"
          ) {
            // desc = descriptions?.find(
            //   (d: any) => d.name === duplicate.description
            // );
            desc = descriptions.descriptions.find(
              (d: any) => d.name === duplicate.description
            );
          }

          const colorRate =
            options?.colorFinishes.find(
              (c: any) => c.name === duplicate.colorFinish
            )?.rate ?? 0;
          const meshRate =
            duplicate.meshPresent
              ? options?.meshTypes.find(
                (m: any) => m.name === duplicate.meshType
              )?.rate ?? 0
              : 0;

          const glassRate =
            options?.glassSpecs.find(
              (g: any) => g.name === duplicate.glassSpec
            )?.rate ?? 0;

          const handleOpt = options?.handleOptions.find(
            (h: any) => h.name === duplicate.handleType
          );

          const handleCount = desc?.defaultHandleCount ?? 0;

          const handleUnitRate =
            handleOpt?.colors.find(
              (c: any) => c.name === duplicate.handleColor
            )?.rate ?? 0;

          const handleRate =
            handleCount > 0
              ? (handleCount * handleUnitRate) /
              (Number(duplicate.area) || 1)
              : 0;
          const exhaustFanRate = duplicate.hasExhaustFan ? EXHAUST_FAN_RATE_SURCHARGE : 0;

          duplicate.rate =
            (rateResult.baseRate ?? 0) +
            colorRate +
            meshRate +
            glassRate +
            handleRate +
            exhaustFanRate;

          duplicate.rate = Number(duplicate.rate.toFixed(2));

          duplicate.amount = Number(
            (
              duplicate.rate *
              Number(duplicate.area) *
              Number(duplicate.quantity || 1)
            ).toFixed(2)
          );

          console.log("FINAL DUPLICATE RATE", {
            baseRate: rateResult.baseRate,
            colorRate,
            meshRate,
            glassRate,
            handleRate,
            finalRate: duplicate.rate,
            amount: duplicate.amount,
          });
          const savedItem = await createQuotationItem(quotationId, duplicate);
          useQuotationBuilderStore.getState().replaceItem(duplicateLocalId, savedItem);
          markSaved();
          const latestQuotation = await getQuotation(quotationId);

          console.log("LATEST QUOTATION", latestQuotation);
          console.log(
            latestQuotation?.items.map((item) => ({
              refCode: item.refCode,
              rate: item.rate,
              amount: item.amount,
              refImage: item.refImage,
              area: item.area,
            }))
          );

          console.log({
            savedRate: savedItem.rate,
            savedImage: savedItem.refImage,
            savedArea: savedItem.area,
          });
          console.log("SAVED ITEM", savedItem);
        } catch (error) {
          useQuotationBuilderStore.getState().removeItem(duplicateLocalId);
          throw error;
        }
      }),
    [ensureParentQuotation, markSaved, runItemMutation]
  );

  const persistReorderedItems = useCallback(
    (startIndex: number, endIndex: number) =>
      runItemMutation(async () => {
        const store = useQuotationBuilderStore.getState();
        store.reorderItems(startIndex, endIndex);
        try {
          const quotationId = await ensureParentQuotation();
          const itemIds = useQuotationBuilderStore
            .getState()
            .quotation.items.map(getServerQuotationItemId);
          if (itemIds.some((id) => !id)) {
            throw new Error("All items must be saved before they can be reordered");
          }
          await reorderQuotationItems(quotationId, itemIds);
          markSaved();
        } catch (error) {
          useQuotationBuilderStore.getState().reorderItems(endIndex, startIndex);
          alert("Failed to save the new item order.");
          throw error;
        }
      }),
    [ensureParentQuotation, markSaved, runItemMutation]
  );

  const persistBulkUpdate = useCallback(
    async (field: BulkUpdateField, from: string, to: string) => {
      let updatedCount = 0;
      await runItemMutation(async () => {
        const quotationId = await ensureParentQuotation();
        const result = await bulkUpdateQuotationItems(
          quotationId,
          field,
          from,
          to
        );
        setQuotation(result.quotation);
        updatedCount = result.updatedCount;
        markSaved();
      });
      return updatedCount;
    },
    [ensureParentQuotation, markSaved, runItemMutation, setQuotation]
  );

  useEffect(() => {
    const savedGlobalConfig = quotation.globalConfig;
    const quotationKey = quotation._id ?? null;

    if (!savedGlobalConfig || !quotationKey) return;
    if (hydratedGlobalConfigKeyRef.current === quotationKey) return;

    hydratedGlobalConfigKeyRef.current = quotationKey;
    if (savedGlobalConfig.isOverridden !== true) return;
    setGlobalConfig((prev) => ({
      ...prev,
      isOverridden: true,
      logo: savedGlobalConfig.logo || prev.logo,
      logoUrl: savedGlobalConfig.logo || prev.logoUrl,
      website: savedGlobalConfig.website || prev.website,
      prerequisites: savedGlobalConfig.prerequisites || prev.prerequisites,
      paymentInfo: savedGlobalConfig.paymentInfo || prev.paymentInfo,
      terms: savedGlobalConfig.terms || prev.terms,
      additionalCosts: {
        ...prev.additionalCosts,
        installation: savedGlobalConfig.additionalCosts?.installation ?? prev.additionalCosts.installation,
        transport: savedGlobalConfig.additionalCosts?.transport ?? prev.additionalCosts.transport,
        loadingUnloading: savedGlobalConfig.additionalCosts?.loadingUnloading ?? prev.additionalCosts.loadingUnloading,
        discountPercent: savedGlobalConfig.additionalCosts?.discountPercent ?? prev.additionalCosts.discountPercent,
        showInstallation: savedGlobalConfig.additionalCosts?.showInstallation ?? prev.additionalCosts.showInstallation,
        showTransport: savedGlobalConfig.additionalCosts?.showTransport ?? prev.additionalCosts.showTransport,
        showLoadingUnloading: savedGlobalConfig.additionalCosts?.showLoadingUnloading ?? prev.additionalCosts.showLoadingUnloading,
        showDiscount: savedGlobalConfig.additionalCosts?.showDiscount ?? prev.additionalCosts.showDiscount,
      },
    }));
  }, [quotation._id, quotation.globalConfig]);

  useEffect(() => {
    const nextGlobalConfig = {
      isOverridden: globalConfig.isOverridden,
      logo: globalConfig.logo || "",
      website: globalConfig.website || "",
      terms: globalConfig.terms || "",
      prerequisites: globalConfig.prerequisites || "",
      paymentInfo: globalConfig.paymentInfo || "",
      additionalCosts: {
        installation: Number(globalConfig.additionalCosts.installation) || 0,
        transport: Number(globalConfig.additionalCosts.transport) || 0,
        loadingUnloading: Number(globalConfig.additionalCosts.loadingUnloading) || 0,
        discountPercent: Number(globalConfig.additionalCosts.discountPercent) || 0,
        showInstallation: globalConfig.additionalCosts.showInstallation ?? true,
        showTransport: globalConfig.additionalCosts.showTransport ?? true,
        showLoadingUnloading: globalConfig.additionalCosts.showLoadingUnloading ?? true,
        showDiscount: globalConfig.additionalCosts.showDiscount ?? true,
      },
    };

    const currentGlobalConfig = quotation.globalConfig;
    const isSameGlobalConfig =
      Boolean(currentGlobalConfig?.isOverridden) === Boolean(nextGlobalConfig.isOverridden) &&
      (currentGlobalConfig?.logo || "") === nextGlobalConfig.logo &&
      (currentGlobalConfig?.website || "") === nextGlobalConfig.website &&
      (currentGlobalConfig?.terms || "") === nextGlobalConfig.terms &&
      (currentGlobalConfig?.prerequisites || "") === nextGlobalConfig.prerequisites &&
      (currentGlobalConfig?.paymentInfo || "") === nextGlobalConfig.paymentInfo &&
      (Number(currentGlobalConfig?.additionalCosts?.installation) || 0) === nextGlobalConfig.additionalCosts.installation &&
      (Number(currentGlobalConfig?.additionalCosts?.transport) || 0) === nextGlobalConfig.additionalCosts.transport &&
      (Number(currentGlobalConfig?.additionalCosts?.loadingUnloading) || 0) === nextGlobalConfig.additionalCosts.loadingUnloading &&
      (Number(currentGlobalConfig?.additionalCosts?.discountPercent) || 0) === nextGlobalConfig.additionalCosts.discountPercent &&
      (currentGlobalConfig?.additionalCosts?.showInstallation ?? true) === nextGlobalConfig.additionalCosts.showInstallation &&
      (currentGlobalConfig?.additionalCosts?.showTransport ?? true) === nextGlobalConfig.additionalCosts.showTransport &&
      (currentGlobalConfig?.additionalCosts?.showLoadingUnloading ?? true) === nextGlobalConfig.additionalCosts.showLoadingUnloading &&
      (currentGlobalConfig?.additionalCosts?.showDiscount ?? true) === nextGlobalConfig.additionalCosts.showDiscount;

    if (isSameGlobalConfig) return;

    updateGlobalConfig(nextGlobalConfig);
  }, [globalConfig, quotation.globalConfig, updateGlobalConfig]);

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
      console.log(quotationWithGlobalConfig);
      console.log("[quotation-pdf] export requested", {
        quotationId: quotationWithGlobalConfig._id ?? quotationWithGlobalConfig.quotationDetails.id,
        quoteNo: quotationWithGlobalConfig.generatedId ?? quotationWithGlobalConfig.quotationDetails.id,
        itemCount: quotationWithGlobalConfig.items?.length ?? 0,
        hasGlobalConfig: Boolean(globalConfig),
        hasLogo: Boolean(globalConfig?.logoUrl || globalConfig?.logo)
      });
      const savedQuotation = await getPersistedQuotation();
      const pdfQuotationId =
        savedQuotation?._id ??
        quotationWithGlobalConfig._id ??
        savedQuotation?.quotationDetails.id ??
        quotationWithGlobalConfig.quotationDetails.id;

      if (!pdfQuotationId) {
        throw new Error("Failed to resolve quotation id before PDF generation.");
      }

      const delivery = await prepareQuotationPdf(pdfQuotationId);
      let nextPdfPreviewUrl: string;
      if (delivery.delivery === "signed-url") {
        nextPdfPreviewUrl = delivery.previewUrl;
        setPdfDirectDownloadUrl(delivery.downloadUrl);
      } else {
        const blob = await getQuotationPdfBlob(pdfQuotationId);
        nextPdfPreviewUrl = URL.createObjectURL(blob);
        setPdfDirectDownloadUrl(null);
      }
      setPdfPreviewTitle("Quotation PDF Preview");
      setPdfDownloadName(getQuotationPdfDownloadName({ ...(savedQuotation ?? quotationWithGlobalConfig), globalConfig }));
      setPdfPreviewUrl((currentUrl) => {
        if (currentUrl?.startsWith("blob:")) {
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
  const shareQuotation = async () => {
    try {
      setIsSharingQuotation(true);
      const savedQuotation = await getPersistedQuotation();
      const quotationId =
        savedQuotation?._id ??
        quotationWithGlobalConfig._id ??
        savedQuotation?.quotationDetails.id ??
        quotationWithGlobalConfig.quotationDetails.id;

      if (!quotationId) throw new Error("Save the quotation before sharing it.");

      const phone = savedQuotation?.customerDetails.phone || quotationWithGlobalConfig.customerDetails.phone;
      if (!phone) throw new Error("Add the customer's WhatsApp phone number before sharing.");

      const effectiveQuotation = savedQuotation ?? quotationWithGlobalConfig;
      const pdf = await getQuotationPdfBlob(quotationId);
      await shareQuotationPdf({
        pdf,
        fileName: getQuotationPdfDownloadName({ ...effectiveQuotation, globalConfig }),
        phone,
        customerName: effectiveQuotation.customerDetails.name,
        quotationNumber:
          effectiveQuotation.generatedId || effectiveQuotation.quotationDetails.id || quotationId,
      });
      alert("Quotation shared successfully on WhatsApp.");
    } catch (error) {
      console.error("Failed to share quotation", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to share quotation on WhatsApp.";
      alert(message);
    } finally {
      setIsSharingQuotation(false);
    }
  };
  const exportExcel = async () => {
    try {
      setIsGeneratingExcel(true);

      const savedQuotation = await getPersistedQuotation();

      const quotationId =
        savedQuotation?._id ??
        quotationWithGlobalConfig._id ??
        savedQuotation?.quotationDetails.id ??
        quotationWithGlobalConfig.quotationDetails.id;

      if (!quotationId) {
        throw new Error("Failed to resolve quotation id before Excel generation.");
      }

      const blob = await getQuotationExcelBlob(quotationId, true);

      const quoteNo =
        savedQuotation?.generatedId ||
        savedQuotation?.quotationDetails.id ||
        quotationWithGlobalConfig.generatedId ||
        quotationWithGlobalConfig.quotationDetails.id ||
        "quotation";

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${quoteNo}.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Failed to export Excel", error);
      alert("Failed to generate Excel.");
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const exportElevationPdf = async () => {
    try {
      setIsGeneratingElevation(true);

      const savedQuotation = await getPersistedQuotation();

      const pdfQuotationId =
        savedQuotation?._id ??
        quotationWithGlobalConfig._id ??
        savedQuotation?.quotationDetails.id ??
        quotationWithGlobalConfig.quotationDetails.id;

      const blob = await getElevationPdfBlob(pdfQuotationId);

      const nextUrl = URL.createObjectURL(blob);

      setPdfPreviewTitle("Elevation PDF Preview");
      setPdfDownloadName("elevation.pdf");
      setPdfDirectDownloadUrl(null);

      setPdfPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return nextUrl;
      });

      setIsPdfPreviewOpen(true);

    } catch (error) {
      console.error("Elevation PDF error", error);
      alert("Failed to generate elevation PDF");
    } finally {
      setIsGeneratingElevation(false);
    }
  };
  const exportCuttingSchedule = async () => {
    try {
      setIsGeneratingCuttingSchedule(true);
      const savedQuotation = await getPersistedQuotation();
      const pdfQuotationId =
        savedQuotation?._id ??
        quotationWithGlobalConfig._id ??
        savedQuotation?.quotationDetails.id ??
        quotationWithGlobalConfig.quotationDetails.id;

      if (!pdfQuotationId) {
        throw new Error("Failed to resolve quotation id before cutting schedule generation.");
      }

      const blob = await getCuttingSchedulePdfBlob(pdfQuotationId);
      const nextPdfPreviewUrl = URL.createObjectURL(blob);
      const quoteNo =
        savedQuotation?.generatedId ||
        savedQuotation?.quotationDetails.id ||
        quotationWithGlobalConfig.generatedId ||
        quotationWithGlobalConfig.quotationDetails.id ||
        "quotation";
      setPdfPreviewTitle("Cutting Schedule PDF Preview");
      setPdfDownloadName(`${quoteNo}-cutting-schedule.pdf`);
      setPdfDirectDownloadUrl(null);
      setPdfPreviewUrl((currentUrl) => {
        if (currentUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextPdfPreviewUrl;
      });
      setIsPdfPreviewOpen(true);
    } catch (error) {
      console.error("Failed to export cutting schedule PDF", error);
      alert("Failed to generate cutting schedule.");
    } finally {
      setIsGeneratingCuttingSchedule(false);
    }
  };
  const exportBom = async () => {
    try {
      setIsGeneratingBom(true);
      const savedQuotation = await getPersistedQuotation();
      const pdfQuotationId =
        savedQuotation?._id ??
        quotationWithGlobalConfig._id ??
        savedQuotation?.quotationDetails.id ??
        quotationWithGlobalConfig.quotationDetails.id;

      if (!pdfQuotationId) {
        throw new Error("Failed to resolve quotation id before BOM generation.");
      }

      const [blob, orderData] = await Promise.all([
        getBomPdfBlob(pdfQuotationId),
        getBomOrderData(pdfQuotationId),
      ]);
      const nextPdfPreviewUrl = URL.createObjectURL(blob);
      const quoteNo =
        savedQuotation?.generatedId ||
        savedQuotation?.quotationDetails.id ||
        quotationWithGlobalConfig.generatedId ||
        quotationWithGlobalConfig.quotationDetails.id ||
        "quotation";
      setPdfPreviewTitle("BOM PDF Preview");
      setPdfDownloadName(`${quoteNo}-bom.pdf`);
      setBomOrderData(orderData);
      setPdfDirectDownloadUrl(null);
      setPdfPreviewUrl((currentUrl) => {
        if (currentUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextPdfPreviewUrl;
      });
      setIsPdfPreviewOpen(true);
    } catch (error) {
      console.error("Failed to export BOM PDF", error);
      alert("Failed to generate BOM.");
    } finally {
      setIsGeneratingBom(false);
    }
  };
  const exportGlassReport = async () => {
    try {
      setIsGeneratingGlassReport(true);
      const savedQuotation = await getPersistedQuotation();
      const pdfQuotationId =
        savedQuotation?._id ??
        quotationWithGlobalConfig._id ??
        savedQuotation?.quotationDetails.id ??
        quotationWithGlobalConfig.quotationDetails.id;
      if (!pdfQuotationId) {
        throw new Error("Failed to resolve quotation id before Glass Report generation.");
      }
      const blob = await getGlassReportPdfBlob(pdfQuotationId);
      const nextPdfPreviewUrl = URL.createObjectURL(blob);
      const quoteNo =
        savedQuotation?.generatedId ||
        savedQuotation?.quotationDetails.id ||
        quotationWithGlobalConfig.generatedId ||
        quotationWithGlobalConfig.quotationDetails.id ||
        "quotation";
      setPdfPreviewTitle("Glass Report PDF Preview");
      setPdfDownloadName(`${quoteNo}-glass-report.pdf`);
      setPdfDirectDownloadUrl(null);
      setPdfPreviewUrl((currentUrl) => {
        if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
        return nextPdfPreviewUrl;
      });
      setIsPdfPreviewOpen(true);
    } catch (error) {
      console.error("Failed to export Glass Report PDF", error);
      alert("Failed to generate Glass Report.");
    } finally {
      setIsGeneratingGlassReport(false);
    }
  };
  const closePdfPreview = () => {
    setIsPdfPreviewOpen(false);
  };
  const downloadPreviewedPdf = () => {
    if (!pdfPreviewUrl) return;
    const link = document.createElement("a");
    link.href = pdfDirectDownloadUrl || pdfPreviewUrl;
    link.download = pdfDownloadName || getQuotationPdfDownloadName({ ...quotation, globalConfig });
    if (pdfDirectDownloadUrl) link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const pageTitle = isCreateMode ? "Create Quotation" : "Edit Quotation";
  const pageDescription = quotation.generatedId ? `#${quotation.generatedId}` : "";
  const isSaveBlockingExports =
    metadataSaveStatus === "saving" ||
    itemMutationsInProgress > 0;
  const isAnyExportInProgress =
    isGeneratingPdf ||
    isGeneratingCuttingSchedule ||
    isGeneratingBom ||
    isGeneratingGlassReport ||
    isGeneratingElevation ||
    isGeneratingExcel ||
    isSharingQuotation;

  return (
    <PageShell
      title={pageTitle}
      description={pageDescription}
      backButton={
        <button
          type="button"
          onClick={() => router.push("/quotations")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      }

      actions={
        <>
          <Badge variant={metadataSaveStatus === "failed" ? "danger" : itemMutationsInProgress > 0 ? "warning" : "success"}>
            {itemMutationsInProgress > 0
              ? "Saving item..."
              : metadataSaveStatus === "saving"
                ? "Saving..."
                : metadataSaveStatus === "failed"
                  ? "Save failed"
                  : saveState}
          </Badge>
          <Button
            variant="outline"
            onClick={shareQuotation}
            disabled={isSaveBlockingExports || isAnyExportInProgress}
          >
            <Share2 className="h-4 w-4" />
            {isSharingQuotation ? "Sharing..." : "Share"}
          </Button>
        </>

      }
    >

      <div id="quotation-pdf-root" className="space-y-6">
        <Card className="border-0 bg-white/90">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-2xl px-4 py-2 text-sm transition ${activeTab === tab.key
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* RIGHT SIDE BUTTONS */}
            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                disabled={isSaveBlockingExports || isAnyExportInProgress}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>

              <button
                type="button"
                onClick={handleAddItem}
                disabled={metadataSaveStatus === "saving" || itemMutationsInProgress > 0}
                className="rounded-xl bg-[#EE1C25] px-4 py-2 text-sm text-white hover:bg-[#D61920] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Item
              </button>

            </div>


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
            {activeTab === "Details" && (
              <CustomerTab
                onSave={saveCurrentMetadata}
                isSaving={metadataSaveStatus === "saving"}
              />
            )}
            {activeTab === "global" && (
              <GlobalConfigTab
                globalConfig={globalConfig}
                setGlobalConfig={setGlobalConfig}
                logoPreview={logoPreview}
                handleLogoUpload={handleLogoUpload}
                onSave={saveQuotationGlobalOverride}
                isSaving={metadataSaveStatus === "saving"}
              />
            )}
            {activeTab === "item" && (
              <ItemTab
                quotationBasePath={quotationBasePath}
                onDeleteItem={persistDeleteItem}
                onDuplicateItem={persistDuplicateItem}
                onReorderItems={persistReorderedItems}
              />
            )}
            {activeTab === "bulk" && (
              <BulkUpdateTab
                quotation={quotation}
                onApply={persistBulkUpdate}
                isSaving={itemMutationsInProgress > 0}
              />
            )}

          </motion.div>
        </AnimatePresence>

        {isExportModalOpen ? (
          <div
            className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsExportModalOpen(false)}
          >
            <div
              className="w-full max-w-4xl rounded-[24px] bg-white p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Generate & Export
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Select a document format to generate
                  </p>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {/* 4. Quotation (CURRENT) */}
                <button
                  onClick={() => {
                    setActiveExport("quotation");
                    exportPdf();
                  }}
                  disabled={isSaveBlockingExports || isAnyExportInProgress}
                  className="relative flex w-full flex-col items-start gap-3 rounded-[20px] border-2 border-red-100 bg-white p-6 min-h-[160px] justify-between shadow-sm transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50 group"
                >
                  <div className="absolute right-4 top-4 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black tracking-wider text-[#EE1C25] uppercase">
                    Primary
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-[#EE1C25] group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  </div>
                  <div className="text-left mt-2">
                    <div className="text-lg font-bold text-slate-900">{isGeneratingPdf ? "Opening..." : "Quotation"}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">
                      {pdfPreparationStatus === "preparing"
                        ? "Preparing PDF in background…"
                        : pdfPreparationStatus === "ready"
                          ? "PDF ready"
                          : pdfPreparationStatus === "failed"
                            ? "Preparation failed — retry on open"
                            : "Main pricing document"}
                    </div>
                  </div>
                </button>

                {/* 1. Cutting */}
                <button
                  onClick={() => {
                    setActiveExport("cutting");
                    exportCuttingSchedule();
                  }}
                  disabled={isSaveBlockingExports || isAnyExportInProgress}
                  className="flex w-full flex-col items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-6 min-h-[160px] justify-between shadow-sm transition hover:border-amber-200 hover:bg-amber-50 disabled:opacity-50 group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
                  </div>
                  <div className="text-left mt-2">
                    <div className="text-lg font-bold text-slate-900">{isGeneratingCuttingSchedule ? "Generating..." : "Cutting"}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">Optimised materials list</div>
                  </div>
                </button>

                {/* 2. BOM */}
                <button
                  onClick={() => {
                    setActiveExport("bom");
                    exportBom();
                  }}
                  disabled={isSaveBlockingExports || isAnyExportInProgress}
                  className="flex w-full flex-col items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-6 min-h-[160px] justify-between shadow-sm transition hover:border-violet-200 hover:bg-violet-50 disabled:opacity-50 group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-100 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                  </div>
                  <div className="text-left mt-2">
                    <div className="text-lg font-bold text-slate-900">{isGeneratingBom ? "Generating..." : "BOM"}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">Bill of materials</div>
                  </div>
                </button>

                {/* 3. Glass Report */}
                <button
                  onClick={() => {
                    setActiveExport("glass");
                    exportGlassReport();
                  }}
                  disabled={isSaveBlockingExports || isAnyExportInProgress}
                  className="flex w-full flex-col items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-6 min-h-[160px] justify-between shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50 group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  </div>
                  <div className="text-left mt-2">
                    <div className="text-lg font-bold text-slate-900">{isGeneratingGlassReport ? "Generating..." : "Glass Report"}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">Detailed panel schedule</div>
                  </div>
                </button>

                {/* 5. Elevation */}
                <button
                  onClick={() => {
                    setActiveExport("elevation");
                    exportElevationPdf();
                  }}
                  disabled={isSaveBlockingExports || isAnyExportInProgress}
                  className="flex w-full flex-col items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-6 min-h-[160px] justify-between shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-50 group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 group-hover:bg-emerald-100 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                  </div>
                  <div className="text-left mt-2">
                    <div className="text-lg font-bold text-slate-900">{isGeneratingElevation ? "Generating..." : "Elevation"}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">Technical drawing view</div>
                  </div>
                </button>

                {/* 6. Download Excel */}
                <button
                  onClick={() => {
                    setActiveExport("excel");
                    setIsExcelExportModalOpen(true);
                  }}
                  disabled={isSaveBlockingExports || isAnyExportInProgress}
                  className="flex w-full flex-col items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-6 min-h-[160px] justify-between shadow-sm transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-[#0F172A] group-hover:bg-slate-200 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  </div>
                  <div className="text-left mt-2">
                    <div className="text-lg font-bold text-slate-900">{typeof isGeneratingExcel !== 'undefined' && isGeneratingExcel ? "Generating..." : "Excel Data"}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">Raw .xlsx export</div>
                  </div>
                </button>

              </div>
            </div>
          </div>
        ) : null}

        {isPdfPreviewOpen && pdfPreviewUrl ? (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/70 p-4">
            <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{pdfPreviewTitle}</div>
                  <div className="text-sm text-slate-500">{pdfDownloadName || getQuotationPdfDownloadName({ ...quotation, globalConfig })}</div>
                </div>
                <div className="flex items-center gap-3">
                  {pdfPreviewTitle === "BOM PDF Preview" && bomOrderData ? (
                    <Button onClick={() => setIsOrderPlacementOpen(true)}>
                      <ShoppingCart className="h-4 w-4" />
                      Place Order
                    </Button>
                  ) : null}
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
        {isOrderPlacementOpen && bomOrderData ? (
          <BomOrderPlacement
            bom={bomOrderData}
            onClose={() => setIsOrderPlacementOpen(false)}
            onSuccess={() => undefined}
          />
        ) : null}
      </div>
      {isExcelExportModalOpen ? (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Export Excel
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Do you want to download the Excel?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsExcelExportModalOpen(false);
                }}
              >
                No
              </Button>

              <Button
                className="bg-[#0F172A] hover:bg-[#0F172A]"
                onClick={() => {
                  setIsExcelExportModalOpen(false);
                  exportExcel();
                }}
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
