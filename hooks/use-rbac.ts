"use client";

import { useAuthStore } from "@/store/auth-store";
import type { Permission } from "@/types/auth";

export function useRbac() {
  const permissions = useAuthStore((state) => state.permissions);
  const roles = useAuthStore((state) => state.roles);

  const can = (permission: Permission) => permissions.includes(permission);
  const hasRole = (role: string) => roles.includes(role);

  return { can, hasRole };
}
