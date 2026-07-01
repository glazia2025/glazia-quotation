"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";
import { WindowDoorConfigurator } from "@/modules/product-configurator/components/window-door-configurator";
import {
  createQuotationItem,
  saveQuotationMetadata,
  updateQuotationItem,
} from "@/services/quotation-service";
import type { Quotation, QuotationItem } from "@/types/quotation";

const getQuotationItemIdentity = (item: QuotationItem | null | undefined) => {
  if (!item) return "";
  const withBackendId = item as QuotationItem & { _id?: string };
  return String(item.id || withBackendId._id || item.refCode || "");
};

export function FullPageConfigurator({
  itemId,
  returnPath = "/quotations/new",
  initialQuotation
}: {
  itemId: string;
  returnPath?: string;
  initialQuotation?: Quotation;
}) {
  const router = useRouter();
  const quotationId = useQuotationBuilderStore((state) => state.quotation._id ?? state.quotation.quotationDetails.id);
  const quotation = useQuotationBuilderStore((state) => state.quotation);
  const setQuotation = useQuotationBuilderStore((state) => state.setQuotation);
  const updateItem = useQuotationBuilderStore((state) => state.updateItem);
  const replaceItem = useQuotationBuilderStore((state) => state.replaceItem);
  const applyAutosaveResult = useQuotationBuilderStore((state) => state.applyAutosaveResult);
  const markSaved = useQuotationBuilderStore((state) => state.markSaved);
  const item =
    initialQuotation?.items.find((entry) => getQuotationItemIdentity(entry) === itemId) ??
    quotation.items.find((entry) => getQuotationItemIdentity(entry) === itemId);

  useEffect(() => {
    if (!initialQuotation) return;
    const initialQuotationId = initialQuotation._id ?? initialQuotation.quotationDetails.id;
    const hasRequestedItem = quotation.items.some(
      (entry) => getQuotationItemIdentity(entry) === itemId
    );
    if (quotationId === initialQuotationId && hasRequestedItem) return;
    setQuotation(initialQuotation);
  }, [initialQuotation, itemId, quotation.items, quotationId, setQuotation]);

  const handleClose = () => {
    const target = new URL(returnPath, window.location.origin);
    target.searchParams.set("tab", "item");
    router.push(`${target.pathname}${target.search}`);
  };

  const handleSaveItem = async (nextItem: QuotationItem) => {
    const exists = useQuotationBuilderStore
      .getState()
      .quotation.items.find((i) => getQuotationItemIdentity(i) === itemId);

    let localItemId = nextItem.id;
    if (exists) {
      const realId = exists.id || exists._id;
      if (!realId) throw new Error("Could not resolve the quotation item id");
      localItemId = realId;
      updateItem(realId, nextItem);
    } else {
      const currentQuotation = useQuotationBuilderStore.getState().quotation;
      setQuotation({
        ...currentQuotation,
        items: [...currentQuotation.items, nextItem]
      });
    }

    const snapshot = useQuotationBuilderStore.getState().quotation;
    let quotationId = snapshot._id;
    if (!quotationId) {
      const savedParent = await saveQuotationMetadata(snapshot);
      if (!savedParent?._id) throw new Error("Creating the quotation returned no id");
      applyAutosaveResult(snapshot, savedParent);
      quotationId = savedParent._id;
    }

    const serverItemId = String(exists?._id || exists?.id || "");
    const savedItem = /^[a-f\d]{24}$/i.test(serverItemId)
      ? await updateQuotationItem(quotationId, serverItemId, nextItem)
      : await createQuotationItem(quotationId, nextItem);
    replaceItem(localItemId, savedItem);
    markSaved();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[linear-gradient(180deg,#e2e8f0_0%,#f8fafc_100%)]">
      <div className="h-full w-full">
        {item || !initialQuotation ? (
          <WindowDoorConfigurator
            initialItem={item ?? null}
            profitPercentage={0}
            onSaveItem={handleSaveItem}
            onClose={handleClose}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <div className="text-center">
              <div className="text-xl font-semibold text-slate-900">Configurator item missing</div>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              >
                Back to quotation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
