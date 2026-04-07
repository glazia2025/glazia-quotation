"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Organization, Permission, User } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: User | null;
  organization: Organization | null;
  hydrated: boolean;
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

function syncAuthToken(token: string | null) {
  if (typeof window === "undefined") return;

  if (token) {
    localStorage.setItem("authToken", token);
  } else {
    localStorage.removeItem("authToken");
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      organization: null,
      hydrated: false,
      roles: [],
      permissions: [],
      setSession: ({ token, user, organization, permissions }) =>
        set(() => {
          syncAuthToken(token);
          return {
          token,
          user,
          organization,
          hydrated: true,
          roles: [user.role],
          permissions
          };
        }),
      switchOrganization: (organization) => set({ organization }),
      logout: () =>
        set(() => {
          syncAuthToken(null);
          return {
          token: null,
          user: null,
          organization: null,
          hydrated: true,
          roles: [],
          permissions: []
          };
        })
    }),
    {
      name: "glazia-auth",
      onRehydrateStorage: () => (state) => {
        const token = state?.token ?? null;
        syncAuthToken(token);
        useAuthStore.setState({ hydrated: true });
      }
    }
  )
);
