"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAIN_API_BASE_URL } from "@/services/api";
import type { BomOrderData } from "@/services/quotation-service";
import { getAuthToken } from "@/utils/auth-cookie";
import { formatCurrency } from "@/utils/format";

type Step = "payment" | "proof" | "processing" | "success";

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
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subtotal = Number(bom.totals.grand) || 0;
  const shippingDiscount =
    subtotal >= 2_000_000
      ? 20_000
      : subtotal >= 1_000_000
        ? 10_000
        : subtotal >= 500_000
          ? 5_000
          : subtotal >= 1
            ? 2_500
            : 0;
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
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentProof(String(reader.result || ""));
      setIsUploading(false);
    };
    reader.onerror = () => {
      setError("Failed to read the selected file.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const placeOrder = async () => {
    if (!paymentProof) {
      setError("Please upload the payment proof.");
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
      window.setTimeout(onSuccess, 2000);
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
              {shippingDiscount > 0 ? (
                <div className="flex justify-between border-t border-slate-200 pt-2 font-medium text-green-700">
                  <span>Shipping Discount</span><span>{formatCurrency(shippingDiscount)}</span>
                </div>
              ) : null}
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
                  <h3 className="mb-2 font-semibold text-slate-900">Scan QR Code to Pay (For orders less than 1 lakh)</h3>
                  <p className="mb-4 text-sm text-slate-600">Scan this QR code with any UPI app to pay {formatCurrency(total)}</p>
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
              <Button variant="outline" className="w-full" onClick={onClose}>
                Cancel
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
              {paymentProof ? (
                <div className="space-y-4">
                  <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700">Payment proof uploaded</span>
                    </div>
                    {paymentProof.startsWith("data:application/pdf") ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                        <span className="rounded border bg-white px-2 py-1">PDF</span>
                        <a
                          href={paymentProof}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#124657] hover:underline"
                        >
                          View uploaded PDF
                        </a>
                      </div>
                    ) : (
                      <img
                        src={paymentProof}
                        alt="Payment proof"
                        className="mx-auto h-32 max-w-full rounded object-contain"
                      />
                    )}
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={placeOrder}>
                    Place Order
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setPaymentProof(null);
                      setError("");
                    }}
                  >
                    Upload Different File
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-7 text-sm text-slate-600 hover:border-[#124657] hover:bg-slate-50 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Click to upload payment proof"}
                  <span className="mt-1 block text-xs text-slate-500">PNG, JPG, PDF up to 5MB</span>
                </button>
              )}
              <Button variant="outline" className="w-full" onClick={() => setStep("payment")}>
                Back to QR Code
              </Button>
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
