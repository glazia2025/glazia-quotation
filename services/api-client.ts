import { useAuthStore } from "@/store/auth-store";

type RequestInitWithTenant = RequestInit & {
  tenantScoped?: boolean;
};

export async function apiClient<T>(endpoint: string, init: RequestInitWithTenant = {}) {
  const { token, organization } = useAuthStore.getState();
  const headers = new Headers(init.headers);

  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.tenantScoped !== false && organization) {
    headers.set("X-Tenant-Id", organization.id);
  }

  const response = await fetch(endpoint, { ...init, headers });
  if (!response.ok) {
    throw new Error(`API request failed for ${endpoint}`);
  }

  return (await response.json()) as T;
}
