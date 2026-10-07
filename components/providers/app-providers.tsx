"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useEffect, useState } from "react";

import { useAuthStore } from "@/store/auth-store";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  useEffect(() => useAuthStore.subscribe((state, previous) => {
    if (JSON.stringify(state.user?.access) !== JSON.stringify(previous.user?.access)) queryClient.clear();
  }), [queryClient]);

  useEffect(() => {
    const persistApi = useAuthStore.persist;

    if (persistApi.hasHydrated()) {
      useAuthStore.setState({ hydrated: true });
      return;
    }

    const unsubscribe = persistApi.onFinishHydration(() => {
      useAuthStore.setState({ hydrated: true });
    });

    persistApi.rehydrate();

    return unsubscribe;
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
