"use client";

import { useState } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_30%,#f8fafc_100%)] text-slate-900">
      <div className="flex">
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
        <div className="min-w-0 flex-1">
          <main className="p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
