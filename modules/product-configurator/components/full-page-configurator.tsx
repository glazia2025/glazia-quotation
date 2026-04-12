"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";
import { WindowDoorConfigurator } from "@/modules/product-configurator/components/window-door-configurator";
import type { Quotation, QuotationItem } from "@/types/quotation";

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
  const quotationId = useQuotationBuilderStore((state) => state.quotation.id);
  const quotation = useQuotationBuilderStore((state) => state.quotation);
  const setQuotation = useQuotationBuilderStore((state) => state.setQuotation);
  const updateItem = useQuotationBuilderStore((state) => state.updateItem);
  const item = initialQuotation?.items.find((entry) => entry.id === itemId) ?? quotation.items.find((entry) => entry.id === itemId);

  useEffect(() => {
    if (!initialQuotation) return;
    if (quotationId === initialQuotation.id) return;
    setQuotation(initialQuotation);
  }, [initialQuotation, quotationId, setQuotation]);

  const handleClose = () => {
    const target = new URL(returnPath, window.location.origin);
    target.searchParams.set("tab", "item");
    router.push(`${target.pathname}${target.search}`);
  };

  // const handleSaveItem = (nextItem: QuotationItem) => {
  //   updateItem(itemId, nextItem);
  // };
  const handleSaveItem = (nextItem: QuotationItem) => {
  const exists = quotation.items.find((i) => i.id === itemId);

  if (exists) {
    updateItem(itemId, nextItem);
  } else {
    setQuotation({
      ...quotation,
      items: [...quotation.items, nextItem]
    });
  }
};

  

  return (
    <div className="fixed inset-0 z-[200] bg-[linear-gradient(180deg,#e2e8f0_0%,#f8fafc_100%)]">
      <div className="h-full w-full">
        {item ? (
          <WindowDoorConfigurator
            initialItem={item}
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
