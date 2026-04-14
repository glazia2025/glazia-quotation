"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Shield, Clock, X, CheckCircle2 } from "lucide-react";
import axios from "axios";
import Image from "next/image";

import UserRegistrationForm from "@/components/UserRegistrationForm";
import { API_BASE_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth-store";

async function postAuthRoute<T>(route: "send-otp" | "verify-otp", payload: Record<string, unknown>) {
  const candidates = [`${API_BASE_URL}/api/auth/${route}`, `${API_BASE_URL}/${route}`];
  let lastError: unknown;

  for (const url of candidates) {
    try {
      const response = await axios.post<T>(url, payload);
      return response.data;
    } catch (error) {
      lastError = error;
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`Unable to reach ${route} endpoint.`);
}

export function LoginScreen() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const modalRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [step, setStep] = useState<"phone" | "otp" | "register">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
    }
  }, [router, token]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.replace("/");
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [router]);

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePhoneSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setIsLoading(true);

    console.log(API_BASE_URL);

    try {
      await axios.post(`${API_BASE_URL}/api/auth/send-otp`, { phoneNumber });
      setStep("otp");
      setCountdown(30);
      startCountdown();
    } catch (err) {
      console.error("Error sending OTP:", err);
      setError("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      document.getElementById(`modal-otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`modal-otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const otpValue = otp.join("");
    if (otpValue.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, { phoneNumber, otp: otpValue });
      const { userExists, token: authToken, existingUser } = response.data as {
        userExists?: boolean;
        token?: string;
        existingUser?: {
          _id?: string;
          id?: string;
          userName?: string;
          name?: string;
          email?: string;
          phoneNumber?: string;
          company?: string;
          gstNumber?: string;
          pincode?: string;
          city?: string;
          state?: string;
          address?: string;
          createdAt?: string;
          totalOrders?: number;
          totalSpent?: number;
          loyaltyPoints?: number;
          paUrl?: string;
          dynamicPricing?: boolean;
        };
      };

      if (!userExists) {
        setStep("register");
      } else if (userExists && existingUser) {
        localStorage.setItem("authToken", authToken ?? "");
        const userData = {
          id: existingUser._id || existingUser.id,
          name: existingUser.userName || existingUser.name,
          email: existingUser.email || "",
          phone: existingUser.phoneNumber || phoneNumber,
          company: existingUser.company || "",
          gstNumber: existingUser.gstNumber || "",
          pincode: existingUser.pincode || "",
          city: existingUser.city || "",
          state: existingUser.state || "",
          completeAddress: existingUser.address || "",
          memberSince: existingUser.createdAt,
          totalOrders: existingUser.totalOrders || 0,
          totalSpent: existingUser.totalSpent || 0,
          loyaltyPoints: existingUser.loyaltyPoints || 0,
          paUrl: existingUser.paUrl || "",
          isAuthenticated: true,
          dynamicPricing: existingUser.dynamicPricing,
        };
        localStorage.setItem("glazia-user", JSON.stringify(userData));

        setSession({
          token: authToken ?? "",
          user: {
            id: String(existingUser._id || existingUser.id || "usr-1"),
            name: existingUser.userName || existingUser.name || "Glazia User",
            email: existingUser.email || "",
            role: "sales_manager",
            avatarFallback: (existingUser.userName || existingUser.name || "GU").slice(0, 2).toUpperCase(),
          },
          organization: {
            id: "org-glazia",
            name: "Glazia Fenestration",
            shortCode: "GLZ",
            brandColor: "#0f766e",
          },
          permissions: ["quotations.override_pricing", "quotations.approve", "quotations.convert", "crm.manage"],
        });

        router.replace("/dashboard");
        window.location.reload();
      }
    } catch (err) {
      console.error("OTP Verification Error:", err);
      setError("Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    setIsLoading(true);
    setError("");
    try {
      await axios.post(`${API_BASE_URL}/api/auth/send-otp`, { phoneNumber });
      setCountdown(30);
      startCountdown();
    } catch {
      setError("Failed to resend OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistrationSuccess = () => {
    router.replace("/dashboard");
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className="relative z-10 mx-0 h-[85vh] max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl md:mx-4 md:h-[80vh] md:w-[70vw] md:rounded-2xl"
      >
        <button
          onClick={() => router.replace("/")}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        {step === "phone" && (
          <div className="relative md:h-full">
            <div className="absolute left-[-40vw] top-0 z-[1000] hidden h-[46vw] w-[100vw] rotate-[292deg] bg-[#2F3A4F] md:block" />
            <div style={{ transform: "translateY(-50%)" }} className="absolute left-[4%] top-[50%] z-[10001] hidden text-white md:block">
              <div className="text-[32px]">Welcome To</div>
              <div className="mb-6 text-[68px] font-[500]">Glazia</div>
              <div className="text-[18px]">Sign in to access exclusive<br />pricing and features</div>
            </div>
            <form onSubmit={handlePhoneSubmit} className="z-[10002] w-full space-y-6 p-6 pt-12 md:absolute md:right-[4%] md:top-[50%] md:w-[40%] md:translate-y-[-50%] md:p-8">
              <div className="flex flex-col items-center gap-4">
                <Image width={100} height={100} src="/images/image.png" alt="Glazia Logo" className="h-auto w-20 object-contain" />
                <div className="text-[30px] font-[600] text-[#2F3A4F]">Sign In</div>
              </div>
              <div>
                <label htmlFor="modal-phone" className="mb-2 block text-sm font-medium text-gray-700">Mobile Number</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <span className="font-medium text-gray-500">+91</span>
                  </div>
                  <input
                    id="modal-phone"
                    type="tel"
                    required
                    className="w-full rounded-xl border border-gray-200 py-4 pl-14 pr-4 text-lg transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#124657]"
                    placeholder="Enter 10-digit number"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    autoFocus
                  />
                  {phoneNumber.length === 10 ? (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4"><CheckCircle2 className="h-5 w-5 text-green-500" /></div>
                  ) : null}
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><Shield className="h-3 w-3" />We&apos;ll send you a verification code via Whatsapp</p>
              </div>
              {error ? <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
              <button
                type="submit"
                disabled={isLoading || phoneNumber.length !== 10}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EE1C25] py-4 font-medium text-white shadow-lg shadow-[#124657]/20 transition-all disabled:cursor-not-allowed disabled:bg-[#EE1C25]"
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Phone className="h-5 w-5" />
                    Send OTP
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-500">By continuing, you agree to our <a href="/terms" className="text-[#124657] hover:underline">Terms</a> and <a href="/privacy" className="text-[#124657] hover:underline">Privacy Policy</a></p>
            </form>
          </div>
        )}

        {step === "otp" && (
          <div className="relative md:h-full">
            <div className="absolute left-[-40vw] top-0 z-[1000] hidden h-[46vw] w-[100vw] rotate-[292deg] bg-[#2F3A4F] md:block" />
            <div style={{ transform: "translateY(-50%)" }} className="absolute left-[4%] top-[50%] z-[10001] hidden text-white md:block">
              <div className="text-[32px]">Welcome To</div>
              <div className="mb-6 text-[68px] font-[500]">Glazia</div>
              <div className="text-[18px]">Sign in to access exclusive<br />pricing and features</div>
            </div>
            <form onSubmit={handleOtpSubmit} className="z-[10002] w-full space-y-6 p-6 pt-12 md:absolute md:right-[4%] md:top-[50%] md:w-[40%] md:translate-y-[-50%] md:p-8">
              <div className="flex flex-col items-center gap-4">
                <Image width={100} height={100} src="/images/image.png" alt="Glazia Logo" className="h-auto w-20 object-contain" />
                <div className="text-[30px] font-[600] text-[#2F3A4F]">Sign In</div>
              </div>
              <div>
                <div>
                  <label className="mb-4 block text-center text-sm font-medium text-gray-700">Enter the 6-digit code</label>
                  <div className="flex justify-center gap-3">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`modal-otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="h-14 w-12 rounded-xl border-2 border-gray-200 text-center text-xl font-semibold transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#124657]"
                        value={digit}
                        onChange={(event) => handleOtpChange(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  {countdown > 0 ? (
                    <p className="flex items-center justify-center gap-2 text-sm text-gray-500"><Clock className="h-4 w-4" />Resend code in {countdown}s</p>
                  ) : (
                    <button type="button" onClick={resendOtp} disabled={isLoading} className="text-sm font-medium text-[#EE1C25] hover:underline">Resend OTP</button>
                  )}
                </div>
              </div>
              {error ? <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
              <button
                type="submit"
                disabled={isLoading || otp.join("").length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EE1C25] py-4 font-medium text-white shadow-lg shadow-[#124657]/20 transition-all disabled:cursor-not-allowed disabled:bg-[#EE1C25]"
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5" />
                    Verify OTP
                  </>
                )}
              </button>
              <button type="button" onClick={() => setStep("phone")} className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700">← Change phone number</button>
            </form>
          </div>
        )}

        <div className="p-6 md:p-8">
          {step === "register" ? (
            <div className="-mx-6 max-h-[70vh] overflow-y-auto px-6 md:-mx-8 md:max-h-[60vh] md:px-8">
              <UserRegistrationForm phoneNumber={phoneNumber} onSuccess={handleRegistrationSuccess} isModal />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
