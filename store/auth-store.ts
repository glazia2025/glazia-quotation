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

function clearMatchingStorage(storage: Storage) {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const normalized = key.toLowerCase();
    if (key === "authToken" || normalized.includes("glazia")) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
}

function clearMatchingCookies() {
  if (typeof document === "undefined") return;

  document.cookie.split(";").forEach((entry) => {
    const rawName = entry.split("=")[0]?.trim();
    if (!rawName) return;
    const normalized = rawName.toLowerCase();
    if (rawName === "authToken" || normalized.includes("glazia")) {
      document.cookie = `${rawName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${rawName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
      document.cookie = `${rawName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
    }
  });
}

function clearClientAuthData() {
  if (typeof window === "undefined") return;

  syncAuthToken(null);
  clearMatchingStorage(window.localStorage);
  clearMatchingStorage(window.sessionStorage);
  clearMatchingCookies();
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
          clearClientAuthData();
          useAuthStore.persist.clearStorage();
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
