import { useAuthStore } from "@/store/auth-store";
import { getAuthToken } from "@/utils/auth-cookie";

type RequestInitWithTenant = RequestInit & {
  tenantScoped?: boolean;
};

export async function apiClient<T>(endpoint: string, init: RequestInitWithTenant = {}) {
  const { token, organization } = useAuthStore.getState();
  const headers = new Headers(init.headers);
  const authToken = token ?? getAuthToken();

  headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (init.tenantScoped !== false && organization) {
    headers.set("X-Tenant-Id", organization.id);
  }

  const response = await fetch(endpoint, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    throw new Error(`API request failed for ${endpoint}`);
  }

  return (await response.json()) as T;
}
