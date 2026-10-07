"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";

export function useTenantQuery<TQueryFnData, TError = Error>(
  options: Omit<UseQueryOptions<TQueryFnData, TError>, "queryKey"> & {
    queryKey: string[];
  }
) {
  const organization = useAuthStore((state) => state.organization);
  const access = useAuthStore((state) => state.user?.access);
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  return useQuery({
    ...options,
    queryKey: [...options.queryKey, organization?.id || '', access?.actorId || '', JSON.stringify(access?.permissions || {})],
    enabled: hydrated && Boolean(token) && (options.enabled ?? true)
  });
}
