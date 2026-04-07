"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/store/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) return;

    if (!token && pathname !== "/login") {
      router.replace("/login");
    }
  }, [hydrated, pathname, router, token]);

  if (!hydrated) return null;
  if (!token) return null;
  return <>{children}</>;
}
