"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Organization, Permission, User } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: User | null;
  organization: Organization | null;
  roles: string[];
  permissions: Permission[];
  setSession: (payload: {
    token: string;
    user: User;
    organization: Organization;
    permissions: Permission[];
  }) => void;
  switchOrganization: (organization: Organization) => void;
  logout: () => void;
}

const defaultOrganization: Organization = {
  id: "org-glazia",
  name: "Glazia Fenestration",
  shortCode: "GLZ",
  brandColor: "#0f766e"
};

const defaultUser: User = {
  id: "usr-1",
  name: "Arjun Kapoor",
  email: "arjun@glazia.app",
  role: "sales_manager",
  avatarFallback: "AK"
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: "demo-token",
      user: defaultUser,
      organization: defaultOrganization,
      roles: [defaultUser.role],
      permissions: ["quotations.override_pricing", "quotations.approve", "quotations.convert", "crm.manage"],
      setSession: ({ token, user, organization, permissions }) =>
        set({
          token,
          user,
          organization,
          roles: [user.role],
          permissions
        }),
      switchOrganization: (organization) => set({ organization }),
      logout: () =>
        set({
          token: null,
          user: null,
          organization: null,
          roles: [],
          permissions: []
        })
    }),
    { name: "glazia-auth" }
  )
);
