"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, CopyPlus, Eye, File, HandCoins, Plus, Trash2, Search } from "lucide-react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { deleteQuotation, duplicateQuotation, getQuotations } from "@/services/quotation-service";
import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";


export function QuotationList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<
    "latest" | "oldest" | "enquiry" | "quoted" | "underNegotiation" | "orderConfirmed" | "orderLost"
  >("latest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [deletingQuotationId, setDeletingQuotationId] = useState<string | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<{ id: string; number: string } | null>(null);
  const [duplicatingQuotationId, setDuplicatingQuotationId] = useState<string | null>(null);
  const [quotationToDuplicate, setQuotationToDuplicate] = useState<{
    id: string;
    number: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const pageSize = 20;
  const { data, isLoading, error, refetch } = useTenantQuery({
    queryKey: ["quotations", String(page), search],
    queryFn: () => getQuotations(page, pageSize, search)
  });
  const quotationDetails = useQuotationBuilderStore((s) => s.quotation.quotationDetails);
  const updateQuotationField = useQuotationBuilderStore((s) => s.updateQuotationField);

  console.log(data, "DATAAAAAAA")
  const quotations = data?.quotations ?? [];

  const opportunityOrder: Record<string, number> = {
    Enquiry: 1,
    Quoted: 2,
    "Under Negotiation": 3,
    "Order Confirmed": 4,
    "Order Lost": 5,
  };

  const sortedQuotations = [...quotations].sort((a, b) => {
    const dateA = new Date(a.createdAt ?? 0).getTime();
    const dateB = new Date(b.createdAt ?? 0).getTime();

    const opportunityA =
      a.quotationDetails?.opportunity || "Enquiry";

    const opportunityB =
      b.quotationDetails?.opportunity || "Enquiry";

    if (sortOrder === "latest") {
      return dateB - dateA;
    }

    if (sortOrder === "oldest") {
      return dateA - dateB;
    }

    const selectedStage: Record<string, string> = {
      enquiry: "Enquiry",
      quoted: "Quoted",
      underNegotiation: "Under Negotiation",
      orderConfirmed: "Order Confirmed",
      orderLost: "Order Lost",
    };

    const selectedOpportunity = selectedStage[sortOrder];

    const aSelected = opportunityA === selectedOpportunity;
    const bSelected = opportunityB === selectedOpportunity;

    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;

    return dateB - dateA;
  });

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const totalValue = quotations.reduce((sum, quotation) => {
    const withTopLevelTotal = quotation as typeof quotation & { totalAmount?: number | string };
    return sum + (Number(quotation.breakdown?.totalAmount ?? withTopLevelTotal.totalAmount) || 0);
  }, 0);
  const thisMonthCount = quotations.filter((quotation) => {
    const dateValue = quotation.createdAt;
    if (!dateValue) return false;

    const quotationDate = new Date(dateValue);
    if (Number.isNaN(quotationDate.getTime())) return false;

    const now = new Date();
    return quotationDate.getMonth() === now.getMonth() && quotationDate.getFullYear() === now.getFullYear();
  }).length;

  const handleDeleteQuotation = (quotationId: string, quotationNumber: string) => {
    if (!quotationId || deletingQuotationId) return;

    setDeleteError("");
    setQuotationToDelete({ id: quotationId, number: quotationNumber });
  };

  const handleDuplicateQuotation = (
    quotationId: string,
    quotationNumber: string
  ) => {
    if (!quotationId || duplicatingQuotationId) return;

    setQuotationToDuplicate({
      id: quotationId,
      number: quotationNumber,
    });
  };

  const confirmDuplicateQuotation = async () => {
    if (!quotationToDuplicate || duplicatingQuotationId) return;

    setDuplicatingQuotationId(quotationToDuplicate.id);

    try {
      const duplicatedQuotation = await duplicateQuotation(
        quotationToDuplicate.id
      );

      console.log("Duplicated quotation:", duplicatedQuotation);

      setQuotationToDuplicate(null);

      await refetch();
    } catch (error) {
      console.error("Duplicate quotation failed:", error);
    } finally {
      setDuplicatingQuotationId(null);
    }
  };
  const confirmDeleteQuotation = async () => {
    if (!quotationToDelete || deletingQuotationId) return;

    setDeletingQuotationId(quotationToDelete.id);
    try {
      await deleteQuotation(quotationToDelete.id);
      setQuotationToDelete(null);
      if (quotations.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await refetch();
      }
    } catch (deleteError) {
      console.error("Delete quotation failed:", deleteError);
      setDeleteError("Failed to delete quotation.");
    } finally {
      setDeletingQuotationId(null);
    }
  };

  return (
    <PageShell
      title="Quotations"
      description={
        <div className="flex flex-col gap-2">
          <span>
            Manage draft, submitted, revised, and converted quotations with pricing
            visibility and revision history.
          </span>

          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search quotation, customer..."
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A]"
            />
          </div>
        </div>
      }


      actions={
        <Button asChild
          className="text-white hover:opacity-90"
          style={{ backgroundColor: "#EE1C25" }}
        >
          <Link href="/quotations/new">
            <Plus className="h-4 w-4" />
            New quotation
          </Link>
        </Button>
      }
    >
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Quotations</p>
              <p className="text-2xl font-medium text-gray-900">{total}</p>
            </div>
            <File size={56} color="#080808" absoluteStrokeWidth />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-medium text-gray-900">
                ₹{totalValue.toLocaleString("en-IN")}
              </p>
            </div>
            <HandCoins size={56} color="#080808" absoluteStrokeWidth />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">{thisMonthCount}</p>
            </div>
            <Calendar size={56} color="#080808" absoluteStrokeWidth />
          </div>
        </div>
      </div>

      <Card className="border-0 bg-white/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Quotations</CardTitle>

          <div className="flex items-center gap-2">

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs"
                onClick={() => setIsSortOpen((prev) => !prev)}
              >
                Sort by
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>

              {isSortOpen && (
                <div className="absolute right-0 top-11 z-50 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setSortOrder("latest");
                      setIsSortOpen(false);
                    }}
                  >
                    Latest quotation
                  </button>

                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setSortOrder("oldest");
                      setIsSortOpen(false);
                    }}
                  >
                    Oldest quotation
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setSortOrder("enquiry");
                      setIsSortOpen(false);
                    }}
                  >
                    Enquiry
                  </button>

                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setSortOrder("quoted");
                      setIsSortOpen(false);
                    }}
                  >
                    Quoted
                  </button>

                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setSortOrder("underNegotiation");
                      setIsSortOpen(false);
                    }}
                  >
                    Under Negotiation
                  </button>

                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setSortOrder("orderConfirmed");
                      setIsSortOpen(false);
                    }}
                  >
                    Order Confirmed
                  </button>

                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setSortOrder("orderLost");
                      setIsSortOpen(false);
                    }}
                  >
                    Order Lost
                  </button>

                </div>
              )}
            </div>

          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">Loading quotations...</div> : null}
          {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">Failed to load quotations.</div> : null}

          <div className="hidden md:grid grid-cols-[1.15fr_0.95fr_0.55fr_0.75fr_1.8fr] items-center border-b border-slate-200 px-4 pb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            <div>Quotation</div>
            <div>Customer</div>
            <div>Items</div>

            <div className="justify-self-center">
              Stage
            </div>

            <div className="justify-self-center">
              Actions
            </div>
          </div>
          {sortedQuotations.map((quotation, index) => {
            const customerName =
              quotation.customerDetails?.name ||
              "Unknown customer";
            const quotationId = quotation._id || quotation.quotationDetails?.id || "";
            const quotationNumber = quotation.generatedId || quotation.quotationDetails?.id || quotationId;
            const quotationStatus: string = "Draft";
            const opportunity =
              quotation.quotationDetails?.opportunity || "Enquiry";
            const totalWindows =
              quotation.items?.length ??
              quotation.quotationItems?.length ??
              0;

            return (
              <div
                key={`${quotationId}-${index}`}

                className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 md:grid-cols-[1.15fr_1.05fr_0.75fr_0.75fr_1.8fr] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-900">
                    {quotationNumber}
                  </h3>

                  <Badge
                    variant={
                      quotationStatus === "Approved"
                        ? "success"
                        : quotationStatus === "Rejected"
                          ? "danger"
                          : "outline"
                    }
                  >
                    {quotationStatus}
                  </Badge>
                </div>

                <div className="text-sm text-slate-600">
                  {customerName}
                </div>

                <div className="text-sm text-slate-600">
                  {totalWindows}
                </div>

                <div>
                  <Badge variant="outline">
                    {opportunity}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/quotations/${quotationId}`}>
                      <Eye className="h-4 w-4" />
                      Open
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleDuplicateQuotation(quotationId, quotationNumber)
                    }
                    disabled={duplicatingQuotationId === quotationId}
                  >
                    <CopyPlus className="h-4 w-4" />
                    {duplicatingQuotationId === quotationId
                      ? "Duplicating..."
                      : "Duplicate"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={deletingQuotationId === quotationId}
                    onClick={() =>
                      handleDeleteQuotation(quotationId, quotationNumber)
                    }
                    title="Delete quotation"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingQuotationId === quotationId
                      ? "Deleting..."
                      : "Delete"}
                  </Button>
                </div>
              </div>

            );
          })}
          {!isLoading && !error && quotations.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">No quotations found.</div>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="text-sm text-slate-500">
              Page {page} of {Math.max(totalPages, 1)} | {total} quotations
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {quotationToDelete ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Quotation</h3>
            <p className="mt-2 text-sm text-slate-600">Delete quotation {quotationToDelete.number}? This action cannot be undone.</p>
            {deleteError ? <p className="mt-3 text-sm text-red-600">{deleteError}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setQuotationToDelete(null); setDeleteError(""); }} disabled={Boolean(deletingQuotationId)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmDeleteQuotation} disabled={Boolean(deletingQuotationId)} className="bg-red-600 text-white hover:bg-red-700">
                {deletingQuotationId ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {quotationToDuplicate ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Duplicate Quotation
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to duplicate quotation{" "}
              <span className="font-semibold">
                {quotationToDuplicate.number}
              </span>
              ?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuotationToDuplicate(null)}
                disabled={Boolean(duplicatingQuotationId)}
              >
                No
              </Button>

              <Button
                size="sm"
                onClick={confirmDuplicateQuotation}
                disabled={Boolean(duplicatingQuotationId)}
                className="bg-[#0F172A] hover:bg-[#0F172A]"
              >
                {duplicatingQuotationId ? "Duplicating..." : "Yes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}


    </PageShell>
  );
}
