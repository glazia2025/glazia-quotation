"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, CopyPlus, Eye, File, HandCoins, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { useTenantQuery } from "@/hooks/use-tenant-query";
import { deleteQuotation, getQuotations } from "@/services/quotation-service";

export function QuotationList() {
  const [page, setPage] = useState(1);
  const [deletingQuotationId, setDeletingQuotationId] = useState<string | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<{ id: string; number: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const pageSize = 20;
  const { data, isLoading, error, refetch } = useTenantQuery({
    queryKey: ["quotations", String(page)],
    queryFn: () => getQuotations(page, pageSize)
  });

  console.log(data, "DATAAAAAAA")
  const quotations = data?.quotations ?? [];
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
      description="Manage draft, submitted, revised, and converted quotations with pricing visibility and revision history."
      actions={
        <Button asChild>
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
        <CardHeader>
          <CardTitle>Recent Quotations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">Loading quotations...</div> : null}
          {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">Failed to load quotations.</div> : null}
          {quotations.map((quotation, index) => {
            const customerName =
              quotation.customerDetails?.name ||
              "Unknown customer";
            const quotationId = quotation._id || quotation.quotationDetails?.id || "";
            const quotationNumber = quotation.generatedId || quotation.quotationDetails?.id || quotationId;
            const quotationStatus: string = "Draft";

            return (
              <div key={`${quotationId}-${index}`} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1.2fr_0.8fr_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900">{quotationNumber}</h3>
                    <Badge variant={quotationStatus === "Approved" ? "success" : quotationStatus === "Rejected" ? "danger" : "outline"}>
                      {quotationStatus}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {customerName}
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/quotations/${quotationId}`}>
                      <Eye className="h-4 w-4" />
                      Open
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm">
                    <CopyPlus className="h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={deletingQuotationId === quotationId}
                    onClick={() => handleDeleteQuotation(quotationId, quotationNumber)}
                    title="Delete quotation"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingQuotationId === quotationId ? "Deleting..." : "Delete"}
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
    </PageShell>
  );
}
