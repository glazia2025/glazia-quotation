"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { MAIN_API_BASE_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth-store";
import { getAuthToken } from "@/utils/auth-cookie";

const defaultOrganization = {
  id: "org-glazia",
  name: "Glazia Fenestration",
  shortCode: "GLZ",
  brandColor: "#0f766e",
} as const;

const defaultPermissions = ["quotations.override_pricing", "quotations.approve", "quotations.convert", "crm.manage"] as const;

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    const cookieToken = token || getAuthToken();

    if (!hydrated || !cookieToken || user) return;

    let cancelled = false;
    setBootstrapping(true);

    fetch(`${MAIN_API_BASE_URL}/api/user/getUser`, {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${cookieToken}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to hydrate session (${response.status})`);
        }

        const payload = await response.json();
        const currentUser = payload?.user;

        if (!currentUser || cancelled) return;

        setSession({
          token: cookieToken,
          user: {
            id: String(currentUser._id || currentUser.id || "usr-1"),
            name: currentUser.userName || currentUser.name || "Glazia User",
            email: currentUser.email || "",
            role: "sales_manager",
            avatarFallback: (currentUser.userName || currentUser.name || "GU").slice(0, 2).toUpperCase(),
          },
          organization: defaultOrganization,
          permissions: [...defaultPermissions],
        });
      })
      .catch(() => {
        if (!cancelled) {
          logout();
          router.replace("/login");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBootstrapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, logout, router, setSession, token, user]);

  useEffect(() => {
    if (!hydrated) return;

    if (!token && !getAuthToken() && pathname !== "/login") {
      router.replace("/login");
    }
  }, [hydrated, pathname, router, token]);

  if (!hydrated) return null;
  if (bootstrapping) return null;
  if (!token && !getAuthToken()) return null;
  return <>{children}</>;
}
