"use client";
import type { BomOrderData } from '@/services/quotation-service';
import { PaysharpCheckout } from '@/components/PaysharpCheckout';
export function BomOrderPlacement({ bom, onClose, onSuccess }: { bom: BomOrderData; onClose: () => void; onSuccess: () => void }) {
  return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Place BOM order">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white">
      <PaysharpCheckout checkout={{ quotationId: bom.quotationId }} onCancel={onClose} onDone={() => { onSuccess(); onClose(); }} />
    </div>
  </div>;
}
