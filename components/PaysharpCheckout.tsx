"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MAIN_API_BASE_URL as API_BASE_URL } from "@/services/api";
import { getAuthToken } from "@/utils/auth-cookie";

type CheckoutRequest = { products?: { productId: string; quantity: number }[]; quotationId?: string; sourceOrderId?: string };
type Order = { paymentProvider: "PAYSHARP" | "LEGACY"; _id: string; orderId?: number; totalPaise: number; paidPaise: number; paymentStatus: string; upiAllowed: boolean };
type Account = { virtualAccountNo: string; ifscCode: string; beneficiaryName: string; bankName: string; creditPaise: number };
type Receipt = { reference: string; method: string; utr: string; receivedAt: string; amountPaise: number };
type PaymentData = { upiStatus?: string; order: Order | null; checkout?: Order; account: Account | null; receipts: Receipt[] };
export type PaymentQuote = { paymentProvider: "PAYSHARP" | "LEGACY"; totalPaise: number; subtotalPaise: number; taxPaise: number; products: { productId: string; description: string; quantity: number; amount: number }[] };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
async function request<T>(path: string, body?: unknown): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error("Please sign in again to continue.");
  const response = await fetch(`${API_BASE_URL}${path}`, { method: body === undefined ? "GET" : "POST", credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Unable to process your request. Please retry.");
  return result;
}

export function PaysharpPaymentStatus({ orderId, onPaid }: { orderId: string; onPaid?: () => void }) {
  const [data, setData] = useState<PaymentData | null>(null);
  const [qr, setQr] = useState<{ qrCode?: string; intentUrl?: string; amountPaise: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const paidNotified = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const refresh = useCallback(async (verify = false) => {
    try {
      const next = await request<PaymentData>(`/api/payments/orders/${orderId}${verify ? "/refresh" : ""}`, verify ? {} : undefined);
      setData(next); setError("");
      if (["FAILED", "EXPIRED"].includes(next.upiStatus || "")) setQr(null);
      if (next.order?.paymentStatus === "PAID" && !paidNotified.current) { paidNotified.current = true; onPaidRef.current?.(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load payment status"); }
  }, [orderId]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden && !paidNotified.current) void refresh(); }, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const generateQr = async () => {
    setBusy(true); setError("");
    try {
      const result = await request<{ qrCode?: string; intentUrl?: string; amountPaise: number; status: string }>(`/api/payments/orders/${orderId}/upi`, { kind: /Android|iPhone|iPad/i.test(navigator.userAgent) ? "intent" : "qr" });
      setQr(result); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to generate QR"); }
    finally { setBusy(false); }
  };
  const payment = data?.order ?? data?.checkout;
  const paid = data?.order?.paymentStatus === "PAID";
  return <section className="space-y-4 text-slate-900" aria-live="polite">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {!data || !payment ? <button type="button" onClick={() => void refresh()} className="rounded border px-4 py-2">Load payment details</button> : <>
      <div className="rounded-xl bg-slate-50 p-4">
        <h3 className="font-semibold">{data.order ? `Order #${data.order.orderId}` : "Checkout"} — {paid ? "Payment received — order placed" : payment.paidPaise ? "Partially paid" : "Awaiting payment"}</h3>
        <p>Total: {money(payment.totalPaise)} · Received: {money(payment.paidPaise)}</p>
        <p className="font-semibold">Outstanding: {money(Math.max(0, payment.totalPaise - payment.paidPaise))}</p>
      </div>
      {!paid && <>
        {payment.upiAllowed ? <div className="rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold">Pay by UPI</h3>
          {["FAILED", "EXPIRED"].includes(data.upiStatus || "") && <p className="text-sm text-amber-700">The previous UPI request {data.upiStatus === "EXPIRED" ? "expired" : "failed"}. You can try again.</p>}
          <button type="button" disabled={busy} onClick={generateQr} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Loading…" : "Pay using UPI"}</button>
          {qr?.intentUrl && <a href={qr.intentUrl} className="inline-block rounded-lg bg-green-700 px-4 py-2 text-white">Open UPI app — {money(qr.amountPaise)}</a>}
          {qr?.qrCode && <div><Image unoptimized src={qr.qrCode} alt="Scan with your UPI app to pay this order" width={240} height={240} /><p>QR amount: {money(qr.amountPaise)}. Pay using one method only.</p></div>}
        </div> : <p className="text-sm text-slate-600">UPI is unavailable for this order. Please contact Glazia to arrange payment.</p>}
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); await refresh(true); setBusy(false); }} className="rounded-lg border px-4 py-2 disabled:opacity-50">Check payment status</button>
        <p className="text-sm text-slate-500">{data.checkout ? "Your order will be placed only after UPI payment is verified. Closing this screen keeps your cart and lets you resume payment." : "Complete payment for this existing order."}</p>
      </>}
      {data.order && <a href={`https://glazia.in/account/orders/${data.order._id}`} className="block text-blue-700 underline">View this order in your account</a>}
      {!!data.account?.creditPaise && <p>Unapplied account credit: {money(data.account.creditPaise)}</p>}
      {data.receipts.map(receipt => <div key={receipt.reference} className="rounded border p-3 text-sm">
        <p>{receipt.method === "UPI" ? "UPI" : "Bank transfer"}: {money(receipt.amountPaise)}</p>
        <p className="break-all">UTR: {receipt.utr} · Reference: {receipt.reference}</p>
        <p>{new Date(receipt.receivedAt).toLocaleString("en-IN")}</p>
      </div>)}
    </>}
  </section>;
}

export function PaysharpCheckout({ checkout, onDone, onCancel, renderLegacy }: { checkout: CheckoutRequest; onDone: () => void; onCancel: () => void; renderLegacy: (quote: PaymentQuote, checkoutKey: string, onDone: () => void, onResumePaysharp: (orderId: string) => void) => ReactNode }) {
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [orderId, setOrderId] = useState("");
  const [savedProvider, setSavedProvider] = useState("PAYSHARP");
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [storageKey, setStorageKey] = useState("");
  const serialized = JSON.stringify(checkout);
  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${getAuthToken()}:${serialized}`));
        const storage = "glazia-checkout-" + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
        const existing = sessionStorage.getItem(storage);
        const checkoutKey = existing || crypto.randomUUID();
        sessionStorage.setItem(storage, checkoutKey);
        const result = await request<PaymentQuote>("/api/payments/quote", JSON.parse(serialized));
        if (!cancelled) { setKey(checkoutKey); setStorageKey(storage); setQuote(result); }
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to prepare checkout"); }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [serialized]);
  const place = async () => {
    if (!quote || busy || !key) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ order: Order | null; checkout?: Order }>("/api/user/pi-generate", { ...checkout, checkoutKey: key, expectedTotalPaise: quote.totalPaise, paymentProvider: quote.paymentProvider });
      const target = result.order ?? result.checkout;
      if (!target) throw new Error("Unable to start payment. Please retry.");
      setOrderId(target._id); setSavedProvider(target.paymentProvider);
      setPaymentComplete(result.order?.paymentStatus === "PAID" || result.order?.paymentProvider === "LEGACY");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to place order");
      try { setQuote(await request<PaymentQuote>("/api/payments/quote", checkout)); } catch { /* Keep the actionable creation error. */ }
    } finally { setBusy(false); }
  };
  if (!quote && !orderId) {
    const loading = <div className="space-y-4 p-6" aria-live="polite">
      {error ? <p role="alert" className="text-red-700">{error}</p> : <p>Loading checkout…</p>}
      <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancel</button>
    </div>;
    return <div className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/75 p-4"><div className="w-full max-w-4xl rounded-3xl bg-white">{loading}</div></div>;
  }
  const finish = () => { sessionStorage.removeItem(storageKey); onDone(); };
  // Render the original checkout as a whole, including its own layout and steps.
  if (!orderId && quote?.paymentProvider === "LEGACY" && key) {
    return renderLegacy(quote, key, finish, id => { setOrderId(id); setSavedProvider("PAYSHARP"); });
  }
  return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Place BOM order">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white">
    <div className="space-y-4 p-4 sm:p-6">
    <h2 className="text-xl font-semibold">{orderId ? (savedProvider === "LEGACY" ? "Payment proof submitted" : paymentComplete ? "Order placed" : "Complete your payment") : "Review and pay"}</h2>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {orderId ? <>{savedProvider === "PAYSHARP" ? <PaysharpPaymentStatus orderId={orderId} onPaid={() => setPaymentComplete(true)} /> : <p>Your order is saved. Glazia will review your payment proof.</p>}{paymentComplete && <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-white" onClick={finish}>Done</button>}</> : <>
      {!quote && !error && <p>Calculating current prices…</p>}
      {quote && <>
        <div className="max-h-64 overflow-auto rounded border"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{quote.products.map((p, i) => <tr key={`${p.productId}-${i}`}><td className="p-2">{p.description || p.productId}</td><td>{p.quantity}</td><td>{money(Math.round(p.amount * 100))}</td></tr>)}</tbody></table></div>
        <p>Subtotal: {money(quote.subtotalPaise)} · GST: {money(quote.taxPaise)}</p>
        <p className="text-lg font-semibold">Total: {money(quote.totalPaise)}</p>
        {quote.paymentProvider === "PAYSHARP" && <p className="text-sm">Pay by UPI. Your order is placed only after payment is verified.</p>}
        <button type="button" disabled={busy || !key} onClick={place} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Preparing payment…" : quote.paymentProvider === "LEGACY" ? "Submit proof and place order" : "Continue to UPI payment"}</button>
      </>}
    </>}
    <button type="button" disabled={busy} onClick={paymentComplete ? finish : onCancel} className="rounded-lg border px-4 py-2 ml-2">{orderId ? "Close" : "Cancel"}</button>
  </div></div></div>;
}

// Virtual-account provisioning is paused during the UPI-only rollout.
export function PaysharpAccountCard() {
  return null;
}
