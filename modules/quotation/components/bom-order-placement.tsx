"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAIN_API_BASE_URL } from "@/services/api";
import type { BomOrderData } from "@/services/quotation-service";
import { getAuthToken } from "@/utils/auth-cookie";
import { formatCurrency } from "@/utils/format";

type StoredUser = {
  id?: string;
  name?: string;
  phone?: string;
  city?: string;
};

type Step = "payment" | "proof" | "processing" | "success";

function readStoredUser(): StoredUser {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem("glazia-user") || "{}") as StoredUser;
  } catch {
    return {};
  }
}

export function BomOrderPlacement({
  bom,
  onClose,
  onSuccess,
}: {
  bom: BomOrderData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>("payment");
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subtotal = Number(bom.totals.grand) || 0;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  const selectProof = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Please upload an image or PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Payment proof must be smaller than 5 MB.");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => setPaymentProof(String(reader.result || ""));
    reader.onerror = () => setError("Failed to read the selected file.");
    reader.readAsDataURL(file);
  };

  const placeOrder = async () => {
    if (!paymentProof) {
      setError("Please upload the payment proof.");
      return;
    }

    const user = readStoredUser();
    if (!user.id || !user.name || !user.phone) {
      setError("Your user profile is incomplete. Please log in again before placing the order.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("Authentication token is missing. Please log in again.");
      return;
    }

    setStep("processing");
    setError("");

    try {
      const response = await fetch(`${MAIN_API_BASE_URL}/api/user/pi-generate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user: {
            userId: user.id,
            name: user.name,
            city: user.city || "Not specified",
            phoneNumber: user.phone,
          },
          products: bom.rows.map((row, index) => ({
            productId: row.itemCode || `${bom.projectCode}-${index + 1}`,
            description: [
              row.description,
              row.system && row.series ? `${row.system} - ${row.series}` : "",
            ]
              .filter(Boolean)
              .join(" | "),
            quantity: Number(row.quantity) || 0,
            amount: Number(row.amount) || 0,
          })),
          payment: {
            amount: total,
            proof: paymentProof,
          },
          totalAmount: total,
          deliveryType: "SELF",
        }),
      });

      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message || "Failed to place the order.");
      }

      setStep("success");
      onSuccess();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to place the order.");
      setStep("proof");
    }
  };

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Place BOM Order</h2>
            <p className="text-sm text-slate-500">{bom.projectCode} · {bom.project}</p>
          </div>
          <button
            type="button"
            aria-label="Close order placement"
            onClick={onClose}
            disabled={step === "processing"}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-2xl bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>BOM items</span><span>{bom.rows.length}</span></div>
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span>GST (18%)</span><span>{formatCurrency(tax)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <span>Total payable</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {step === "payment" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-blue-50 p-6 text-center">
                  <h3 className="mb-2 font-semibold text-slate-900">Scan QR Code to Pay</h3>
                  <p className="mb-4 text-sm text-slate-600">For orders below ₹1 lakh</p>
                  <img
                    src="/upi.jpeg"
                    alt="Glazia payment QR code"
                    className="mx-auto h-48 w-48 rounded-lg border bg-white object-contain p-2"
                  />
                  <div className="mt-3 text-sm text-slate-600">
                    <div><strong>UPI ID:</strong> navdeepkamboj08-3@okhdfcbank</div>
                    <div><strong>Amount:</strong> {formatCurrency(total)}</div>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6">
                  <h3 className="mb-4 text-center font-semibold text-slate-900">Net Banking Details</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-green-200 pb-2"><dt>Entity</dt><dd className="font-medium">Glazia Windoors Pvt Ltd</dd></div>
                    <div className="flex justify-between border-b border-green-200 pb-2"><dt>Bank</dt><dd className="font-medium">HDFC Bank</dd></div>
                    <div className="flex justify-between border-b border-green-200 pb-2"><dt>A/C No.</dt><dd className="font-mono">50200084871361</dd></div>
                    <div className="flex justify-between border-b border-green-200 pb-2"><dt>IFSC</dt><dd className="font-mono">HDFC0004809</dd></div>
                    <div className="flex justify-between"><dt>Amount</dt><dd className="font-semibold">{formatCurrency(total)}</dd></div>
                  </dl>
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep("proof")}>
                I&apos;ve Made the Payment
              </Button>
            </>
          ) : null}

          {step === "proof" ? (
            <div className="space-y-4">
              <div className="text-center">
                <Upload className="mx-auto mb-2 h-12 w-12 text-[#124657]" />
                <h3 className="font-semibold text-slate-900">Upload Payment Proof</h3>
                <p className="text-sm text-slate-500">PNG, JPG or PDF up to 5 MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={selectProof}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-7 text-sm text-slate-600 hover:border-[#124657] hover:bg-slate-50"
              >
                {paymentProof ? "Payment proof selected — click to replace" : "Click to select payment proof"}
              </button>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep("payment")}>Back</Button>
                <Button className="flex-1" onClick={placeOrder} disabled={!paymentProof}>Place Order</Button>
              </div>
            </div>
          ) : null}

          {step === "processing" ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto mb-4 h-14 w-14 animate-spin text-[#124657]" />
              <h3 className="font-semibold text-slate-900">Processing Your Order</h3>
              <p className="text-sm text-slate-500">Please do not close this window.</p>
            </div>
          ) : null}

          {step === "success" ? (
            <div className="py-10 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
              <h3 className="text-xl font-semibold text-slate-900">Order Placed Successfully</h3>
              <p className="mt-2 text-sm text-slate-500">The payment proof is awaiting admin confirmation.</p>
              <Button className="mt-6" onClick={onClose}>Done</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
