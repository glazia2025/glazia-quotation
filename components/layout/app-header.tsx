"use client";

import { Bell, Building2, LogOut, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

export function AppHeader() {
  const { user, organization, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-200/80 bg-white/85 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between lg:px-8">
      <div className="flex items-center gap-3">
        <div className="hidden rounded-2xl bg-slate-100 p-3 md:block">
          <Building2 className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{organization?.name}</div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{organization?.shortCode} Tenant Workspace</div>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-3 md:max-w-xl">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search quotations, leads, orders..." />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-2xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50">
          <Bell className="h-4 w-4" />
        </button>
        <Badge variant="outline">{user?.role.replace("_", " ")}</Badge>
        <div className="rounded-2xl bg-slate-950 px-4 py-2 text-sm text-white">
          <div>{user?.name}</div>
          <button onClick={logout} className="mt-1 flex items-center gap-1 text-xs text-slate-300">
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
