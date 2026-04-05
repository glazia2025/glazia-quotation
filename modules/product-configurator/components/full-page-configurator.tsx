"use client";

import { useRouter } from "next/navigation";

import { useQuotationBuilderStore } from "@/modules/quotation/store/use-quotation-builder-store";
import { WindowDoorConfigurator } from "@/modules/product-configurator/components/window-door-configurator";
import type { QuotationItem } from "@/types/quotation";

export function FullPageConfigurator({ itemId }: { itemId: string }) {
  const router = useRouter();
  const quotation = useQuotationBuilderStore((state) => state.quotation);
  const updateItem = useQuotationBuilderStore((state) => state.updateItem);
  const item = quotation.items.find((entry) => entry.id === itemId);

  const handleSaveItem = (nextItem: QuotationItem) => {
    updateItem(itemId, nextItem);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[linear-gradient(180deg,#e2e8f0_0%,#f8fafc_100%)]">
      <div className="h-full w-full p-4 lg:p-6">
        {item ? (
          <WindowDoorConfigurator
            initialItem={item}
            profitPercentage={0}
            onSaveItem={handleSaveItem}
            onClose={() => router.push("/quotations/new")}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <div className="text-center">
              <div className="text-xl font-semibold text-slate-900">Configurator item missing</div>
              <button
                type="button"
                onClick={() => router.push("/quotations/new")}
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
