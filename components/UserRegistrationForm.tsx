"use client";

import { useState } from "react";
import axios from "axios";

import { API_BASE_URL } from "@/services/api";

type UserRegistrationFormProps = {
  phoneNumber: string;
  onSuccess?: () => void;
  isModal?: boolean;
};

type RegistrationPayload = {
  userName: string;
  email: string;
  phoneNumber: string;
  company: string;
  gstNumber: string;
  pincode: string;
  city: string;
  state: string;
  address: string;
};

async function postRegister(payload: RegistrationPayload) {
  const candidates = [
    `${API_BASE_URL}/api/auth/register`,
    `${API_BASE_URL}/api/auth/register-user`,
    `${API_BASE_URL}/register`,
  ];

  let lastError: unknown;

  for (const url of candidates) {
    try {
      const response = await axios.post(url, payload);
      return response.data;
    } catch (error) {
      lastError = error;
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Unable to reach registration endpoint.");
}

export default function UserRegistrationForm({ phoneNumber, onSuccess }: UserRegistrationFormProps) {
  const [form, setForm] = useState({
    userName: "",
    email: "",
    company: "",
    gstNumber: "",
    pincode: "",
    city: "",
    state: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await postRegister({
        ...form,
        phoneNumber,
      });
      onSuccess?.();
    } catch (submitError) {
      console.error("Registration Error:", submitError);
      setError("Failed to complete registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-[#2F3A4F] text-[30px] font-[600]">Complete Registration</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="Full name"
          value={form.userName}
          onChange={(event) => updateField("userName", event.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => updateField("email", event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="Company"
          value={form.company}
          onChange={(event) => updateField("company", event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="GST Number"
          value={form.gstNumber}
          onChange={(event) => updateField("gstNumber", event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="Pincode"
          value={form.pincode}
          onChange={(event) => updateField("pincode", event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="City"
          value={form.city}
          onChange={(event) => updateField("city", event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="State"
          value={form.state}
          onChange={(event) => updateField("state", event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3"
          placeholder="Phone Number"
          value={phoneNumber}
          disabled
        />
      </div>
      <textarea
        className="min-h-28 w-full rounded-xl border border-gray-200 px-4 py-3"
        placeholder="Complete address"
        value={form.address}
        onChange={(event) => updateField("address", event.target.value)}
      />
      {error ? <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-[#EE1C25] py-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Submitting..." : "Complete Registration"}
      </button>
    </form>
  );
}
