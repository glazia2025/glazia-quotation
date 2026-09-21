"use client";
import type { BomOrderData } from '@/services/quotation-service';
import { PaysharpCheckout } from '@/components/PaysharpCheckout';
import { LegacyBomOrderPlacement } from './legacy-bom-order-placement';
export function BomOrderPlacement({ bom, onClose, onSuccess }: { bom: BomOrderData; onClose: () => void; onSuccess: () => void }) {
  return <PaysharpCheckout checkout={{ quotationId: bom.quotationId }} onCancel={onClose} onDone={() => { onSuccess(); onClose(); }}
    renderLegacy={(paymentQuote, checkoutKey, onDone, onResumePaysharp) => <LegacyBomOrderPlacement
      bom={bom} onClose={onClose} onSuccess={onDone} paymentQuote={paymentQuote}
      checkoutKey={checkoutKey} onResumePaysharp={onResumePaysharp} />} />;
}
