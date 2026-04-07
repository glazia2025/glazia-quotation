"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";

export function useTenantQuery<TQueryFnData, TError = Error>(
  options: Omit<UseQueryOptions<TQueryFnData, TError>, "queryKey"> & {
    queryKey: string[];
  }
) {
  const organization = useAuthStore((state) => state.organization);
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  return useQuery({
    ...options,
    queryKey: organization ? [...options.queryKey, organization.id] : options.queryKey,
    enabled: hydrated && Boolean(token) && (options.enabled ?? true)
  });
}
