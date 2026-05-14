import { useAuthStore } from "@/store/auth-store";
import { QUOTATION_API_BASE_URL } from "@/services/api";
import { getAuthToken } from "@/utils/auth-cookie";

type RequestInitWithTenant = RequestInit & {
  tenantScoped?: boolean;
};

export async function apiClient<T>(endpoint: string, init: RequestInitWithTenant = {}) {
  const { token, organization } = useAuthStore.getState();
  const headers = new Headers(init.headers);
  const authToken = token ?? getAuthToken();
  const url = endpoint.startsWith("http") ? endpoint : `${QUOTATION_API_BASE_URL}${endpoint}`;

  headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (init.tenantScoped !== false && organization) {
    headers.set("X-Tenant-Id", organization.id);
  }

  const response = await fetch(url, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    throw new Error(`API request failed for ${url}`);
  }

  return (await response.json()) as T;
}
