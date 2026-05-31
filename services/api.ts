export const MAIN_API_BASE_URL =
  process.env.NEXT_PUBLIC_MAIN_API_BASE_URL ||
  process.env.NEXT_PUBLIC_AUTH_API_BASE_URL ||
  "https://api.glazia.in";

export const QUOTATION_API_BASE_URL =
  process.env.NEXT_PUBLIC_QUOTATION_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://quotation-api.glazia.in";

export const API_BASE_URL = QUOTATION_API_BASE_URL;
