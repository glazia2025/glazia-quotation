"use client";
import type { BomOrderData } from '@/services/quotation-service';
import { PaysharpCheckout } from '@/components/PaysharpCheckout';
import { LegacyBomOrderPlacement } from './legacy-bom-order-placement';
import { useAuthStore } from '@/store/auth-store';
import { canAccess } from '@/types/business-access';
export function BomOrderPlacement({ bom, onClose, onSuccess }: { bom: BomOrderData; onClose: () => void; onSuccess: () => void }) {
  const access = useAuthStore(state => state.user?.access);
  if (!canAccess(access, 'orderPlacement')) return <p>Your owner has not enabled order placement for your account.</p>;
  return <PaysharpCheckout checkout={{ quotationId: bom.quotationId }} onCancel={onClose} onDone={() => { onSuccess(); onClose(); }}
    renderLegacy={(paymentQuote, checkoutKey, onDone, onResumePaysharp) => <LegacyBomOrderPlacement
      bom={bom} onClose={onClose} onSuccess={onDone} paymentQuote={paymentQuote}
      checkoutKey={checkoutKey} onResumePaysharp={onResumePaysharp} />} />;
}
