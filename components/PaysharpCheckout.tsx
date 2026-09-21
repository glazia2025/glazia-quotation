"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MAIN_API_BASE_URL as API_BASE_URL } from "@/services/api";
import { getAuthToken } from "@/utils/auth-cookie";

type CheckoutRequest = { products?: { productId: string; quantity: number }[]; quotationId?: string; sourceOrderId?: string };
type Order = { paymentProvider: "PAYSHARP" | "LEGACY"; _id: string; orderId: number; totalPaise: number; paidPaise: number; paymentStatus: string; upiAllowed: boolean };
type Account = { virtualAccountNo: string; ifscCode: string; beneficiaryName: string; bankName: string; creditPaise: number };
type Receipt = { reference: string; method: string; utr: string; receivedAt: string; amountPaise: number };
type PaymentData = { upiStatus?: string; order: Order; account: Account | null; receipts: Receipt[] };
type Quote = { paymentProvider: "PAYSHARP" | "LEGACY"; totalPaise: number; subtotalPaise: number; taxPaise: number; products: { productId: string; description: string; quantity: number; amount: number }[] };
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
      if (next.order.paymentStatus === "PAID" && !paidNotified.current) { paidNotified.current = true; onPaidRef.current?.(); }
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
  const paid = data?.order.paymentStatus === "PAID";
  return <section className="space-y-4 text-slate-900" aria-live="polite">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {!data ? <button type="button" onClick={() => void refresh()} className="rounded border px-4 py-2">Load payment details</button> : <>
      <div className="rounded-xl bg-slate-50 p-4">
        <h3 className="font-semibold">Order #{data.order.orderId} — {paid ? "Payment received" : data.order.paidPaise ? "Partially paid" : "Awaiting payment"}</h3>
        <p>Total: {money(data.order.totalPaise)} · Received: {money(data.order.paidPaise)}</p>
        <p className="font-semibold">Outstanding: {money(Math.max(0, data.order.totalPaise - data.order.paidPaise))}</p>
      </div>
      {!paid && <>
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Pay by net banking / bank transfer</h3>
          <p className="text-sm text-slate-600">Add these beneficiary details in your bank app or net banking and transfer the amount due. Paysharp collects the payment for Glazia.</p>
          {data.account ? <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 break-all">
            <div><dt className="text-sm text-slate-500">Account number</dt><dd className="font-mono select-all">{data.account.virtualAccountNo}</dd></div>
            <div><dt className="text-sm text-slate-500">IFSC</dt><dd className="font-mono select-all">{data.account.ifscCode}</dd></div>
            <div><dt className="text-sm text-slate-500">Beneficiary</dt><dd className="select-all">{data.account.beneficiaryName}</dd></div>
            <div><dt className="text-sm text-slate-500">Bank</dt><dd>{data.account.bankName}</dd></div>
          </dl> : <p>Bank details are temporarily unavailable. Please contact Glazia.</p>}
          <p className="text-sm text-slate-600">Bank payments settle your oldest unpaid order first. Excess remains as credit for future orders. No payment screenshot is required.</p>
        </div>
        {data.order.upiAllowed ? <div className="rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold">Or pay by UPI</h3>
          {["FAILED", "EXPIRED"].includes(data.upiStatus || "") && <p className="text-sm text-amber-700">The previous UPI request {data.upiStatus === "EXPIRED" ? "expired" : "failed"}. You can try again or use bank transfer.</p>}
          <button type="button" disabled={busy} onClick={generateQr} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Loading…" : "Pay using UPI"}</button>
          {qr?.intentUrl && <a href={qr.intentUrl} className="inline-block rounded-lg bg-green-700 px-4 py-2 text-white">Open UPI app — {money(qr.amountPaise)}</a>}
          {qr?.qrCode && <div><Image unoptimized src={qr.qrCode} alt="Scan with your UPI app to pay this order" width={240} height={240} /><p>QR amount: {money(qr.amountPaise)}. Pay using one method only.</p></div>}
        </div> : <p className="text-sm text-slate-600">Bank transfer is required for orders of ₹1,00,000 or more, or an outstanding balance below ₹1.</p>}
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); await refresh(true); setBusy(false); }} className="rounded-lg border px-4 py-2 disabled:opacity-50">Check payment status</button>
        <a href={`https://glazia.in/account/orders/${orderId}`} className="block text-blue-700 underline">View this order in your account</a>
        <p className="text-sm text-slate-500">Your order is saved. You can return to it while the bank transfer is being processed.</p>
      </>}
      {!!data.account?.creditPaise && <p>Unapplied account credit: {money(data.account.creditPaise)}</p>}
      {data.receipts.map(receipt => <div key={receipt.reference} className="rounded border p-3 text-sm">
        <p>{receipt.method === "UPI" ? "UPI" : "Bank transfer"}: {money(receipt.amountPaise)}</p>
        <p className="break-all">UTR: {receipt.utr} · Reference: {receipt.reference}</p>
        <p>{new Date(receipt.receivedAt).toLocaleString("en-IN")}</p>
      </div>)}
    </>}
  </section>;
}

export function PaysharpCheckout({ checkout, onDone, onCancel }: { checkout: CheckoutRequest; onDone: () => void; onCancel: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [orderId, setOrderId] = useState("");
  const [savedProvider, setSavedProvider] = useState("PAYSHARP");
  const [proof, setProof] = useState("");
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
        const result = await request<Quote>("/api/payments/quote", JSON.parse(serialized));
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
      const result = await request<{ order: Order }>("/api/user/pi-generate", { ...checkout, checkoutKey: key, expectedTotalPaise: quote.totalPaise, paymentProvider: quote.paymentProvider, ...(quote.paymentProvider === "LEGACY" ? { payment: { proof } } : {}) });
      setOrderId(result.order._id); setSavedProvider(result.order.paymentProvider);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to place order");
      try { setQuote(await request<Quote>("/api/payments/quote", checkout)); } catch { /* Keep the actionable creation error. */ }
    } finally { setBusy(false); }
  };
  return <div className="space-y-4 p-4 sm:p-6">
    <h2 className="text-xl font-semibold">{orderId ? (savedProvider === "LEGACY" ? "Payment proof submitted" : "Complete your payment") : "Review and place order"}</h2>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {orderId ? <>{savedProvider === "PAYSHARP" ? <PaysharpPaymentStatus orderId={orderId} /> : <p>Your order is saved. Glazia will review your payment proof.</p>}<button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-white" onClick={() => { sessionStorage.removeItem(storageKey); onDone(); }}>Done</button></> : <>
      {!quote && !error && <p>Calculating current prices…</p>}
      {quote && <>
        <div className="max-h-64 overflow-auto rounded border"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{quote.products.map((p, i) => <tr key={`${p.productId}-${i}`}><td className="p-2">{p.description || p.productId}</td><td>{p.quantity}</td><td>{money(Math.round(p.amount * 100))}</td></tr>)}</tbody></table></div>
        <p>Subtotal: {money(quote.subtotalPaise)} · GST: {money(quote.taxPaise)}</p>
        <p className="text-lg font-semibold">Total: {money(quote.totalPaise)}</p>
        {quote.paymentProvider === "LEGACY" && <div className="space-y-4 rounded-xl border p-4">
          <h3 className="font-semibold">Pay and upload your payment proof</h3>
          {quote.totalPaise < 10000000 && <div><Image unoptimized src="/upi.jpeg" alt="Glazia payment QR code" width={192} height={192} /><p>UPI: navdeepkamboj08-3@okhdfcbank</p></div>}
          <dl className="space-y-1"><div>Beneficiary: Glazia Windoors Pvt Ltd</div><div>Bank: HDFC Bank</div><div>Account: <span className="select-all">50200084871361</span></div><div>IFSC: <span className="select-all">HDFC0004809</span></div></dl>
          <label className="block">Upload payment screenshot or PDF (up to 5 MB)
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} onChange={async event => {
              const file = event.target.files?.[0]; setProof("");
              if (!file) return;
              if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Select a PNG, JPEG, WebP image or PDF up to 5 MB."); return; }
              setBusy(true); setError("");
              const reader = new FileReader();
              reader.onload = () => { setProof(String(reader.result)); setBusy(false); };
              reader.onerror = () => { setError("Unable to read the proof. Please try again."); setBusy(false); };
              reader.readAsDataURL(file);
            }} />
          </label>
          {proof && <p className="text-sm text-green-700">Payment proof ready to submit.</p>}
        </div>}
        {quote.paymentProvider === "PAYSHARP" && <p className="text-sm">{quote.totalPaise < 10000000 ? "Pay by UPI or bank transfer." : "Pay by bank transfer to your assigned virtual account."}</p>}
        <button type="button" disabled={busy || !key || (quote.paymentProvider === "LEGACY" && !proof)} onClick={place} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving order…" : quote.paymentProvider === "LEGACY" ? "Submit proof and place order" : "Place order and pay"}</button>
      </>}
    </>}
    <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-2 ml-2">{orderId ? "Close" : "Cancel"}</button>
  </div>;
}

export function PaysharpAccountCard() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    request<{ paymentProvider: string }>("/api/payments/config").then(config => { if (mounted) setEnabled(config.paymentProvider === "PAYSHARP"); }).catch(() => { if (mounted) setEnabled(false); });
    return () => { mounted = false; };
  }, []);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true); setError("");
    try { setAccount(await request<Account>("/api/payments/account")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load bank details"); }
    finally { setLoading(false); }
  };
  if (!enabled) return null;
  return <section className="rounded-xl border bg-white p-5 space-y-3 text-slate-900">
    <h2 className="text-lg font-semibold">Your Glazia payment account</h2>
    <p className="text-sm text-slate-600">Use your assigned bank details to pay Glazia from net banking or your bank app.</p>
    {!account && <button type="button" disabled={loading} onClick={load} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{loading ? "Loading…" : "View my bank details"}</button>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {account && <>
      <dl className="grid gap-3 sm:grid-cols-2 break-all">
        <div><dt className="text-sm text-slate-500">Account number</dt><dd className="font-mono select-all">{account.virtualAccountNo}</dd></div>
        <div><dt className="text-sm text-slate-500">IFSC</dt><dd className="font-mono select-all">{account.ifscCode}</dd></div>
        <div><dt className="text-sm text-slate-500">Beneficiary</dt><dd className="select-all">{account.beneficiaryName}</dd></div>
        <div><dt className="text-sm text-slate-500">Bank</dt><dd>{account.bankName}</dd></div>
      </dl>
      <p>Unapplied credit: {money(account.creditPaise)}</p>
      <p className="text-sm text-slate-600">Paysharp collects payments for Glazia. Transfers settle your oldest unpaid order first; excess remains as credit for future orders.</p>
      <button type="button" disabled={loading} onClick={load} className="text-sm underline">Refresh balance</button>
    </>}
    <a href="https://glazia.in/account/orders" className="block text-sm text-blue-700 underline">View orders and payments</a>
  </section>;
}
