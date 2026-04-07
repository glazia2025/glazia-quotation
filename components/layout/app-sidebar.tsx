"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPenLine,
  ContactRound,
  Factory,
  FileSpreadsheet,
  Package,
  ReceiptText,
  ScanSearch,
  SendToBack,
  Truck,
  Wrench
} from "lucide-react";
import { Settings } from "lucide-react";

import { defaultSettingsSection, settingsSections } from "@/modules/settings/constants";
import { cn } from "@/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/crm/leads", label: "CRM", icon: ContactRound },
  { href: "/quotations", label: "Quotations", icon: ClipboardPenLine },
  { href: `/settings?section=${defaultSettingsSection}`, label: "Global settings", icon: Settings, matchHref: "/settings" },
 
];

export function AppSidebar({
  collapsed = false,
  onToggle
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSettingsSection = searchParams.get("section") ?? defaultSettingsSection;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-white/50 bg-slate-950 py-6 text-white transition-[width,padding] duration-200 lg:block",
        collapsed ? "w-24 px-3" : "w-72 px-5"
      )}
    >
      <div className={cn("flex rounded-2xl bg-white/5 p-4", collapsed ? "justify-center px-2" : "items-center gap-3")}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/20">
          <SendToBack className="h-5 w-5 text-teal-200" />
        </div>
        {!collapsed ? (
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-teal-200">Glazia</div>
            <div className="font-medium">Fenestration ERP</div>
          </div>
        ) : null}
      </div>
      <div className={cn("mt-4 flex", collapsed ? "justify-center" : "justify-end")}>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="mt-8 space-y-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.matchHref ?? item.href);
          return (
            <div key={item.href} className="space-y-1">
              <Link
                href={item.href}
                className={cn(
                  "flex rounded-2xl py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white",
                  collapsed ? "justify-center px-3" : "items-center gap-3 px-4",
                  active && "bg-white text-slate-950 shadow-sm"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4" />
                {!collapsed ? (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.matchHref === "/settings" ? <ChevronDown className="h-4 w-4" /> : null}
                  </>
                ) : null}
              </Link>
              {!collapsed && item.matchHref === "/settings" && active ? (
                <div className="ml-4 space-y-1 border-l border-white/10 pl-4">
                  {settingsSections.map((section) => {
                    const sectionActive = currentSettingsSection === section.key;
                    return (
                      <Link
                        key={section.key}
                        href={`/settings?section=${section.key}`}
                        className={cn(
                          "block rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white",
                          sectionActive && "bg-white/10 text-white"
                        )}
                      >
                        {section.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
