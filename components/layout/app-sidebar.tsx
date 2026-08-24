"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPenLine,
  LogOut,
  SendToBack,
} from "lucide-react";
import { Settings } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

import { defaultSettingsSection, settingsSections } from "@/modules/settings/constants";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuthStore();
  const isQuotationBuilderPage =
    pathname === "/quotations/new" ||
    (pathname.startsWith("/quotations/") &&
      pathname.split("/").length === 3);
  const currentSettingsSection = searchParams.get("section") ?? defaultSettingsSection;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (isQuotationBuilderPage) {
    return null;
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col overflow-x-hidden border-r border-slate-200 bg-white py-3 text-slate-800 transition-[width,padding] duration-200 lg:flex",
        collapsed ? "w-24 px-3" : "w-72 px-5"

      )}
    >
      <div
        className={cn(
          "flex items-center rounded-lg border border-slate-200 bg-white p-2",
          collapsed ? "justify-center" : "justify-center"
        )}
      >
        <Image
          src="/images/glazia-new-logo.jpeg"
          alt="Glazia"
          width={140}
          height={40}
          className="h-auto w-auto object-contain"
        />
      </div>
      <div className={cn("mt-3 flex", collapsed ? "justify-center" : "justify-end")}>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
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
                  "flex rounded-lg py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900",
                  collapsed ? "justify-center px-2" : "items-center gap-2 px-3",
                  active && "bg-red-50 text-red-600"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-red-600" : "text-slate-600"
                  )}
                />
                {!collapsed ? (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.matchHref === "/settings" ? <ChevronDown className="h-4 w-4 text-slate-600" /> : null}
                  </>
                ) : null}
              </Link>
              {!collapsed && item.matchHref === "/settings" && active ? (
                <div className="ml-3 space-y-1 border-l border-slate-200 pl-3">
                  {settingsSections.map((section) => {
                    const sectionActive = currentSettingsSection === section.key;
                    return (
                      <Link
                        key={section.key}
                        href={`/settings?section=${section.key}`}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-900",
                          sectionActive && "bg-red-50 text-red-600"
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
      <div className="mt-auto pb-12 pt-4">
        <div
          className={cn(
            "rounded-lg border border-slate-200 bg-white",
            collapsed ? "p-2" : "p-2"
          )}
        >
          {!collapsed ? (
            <div className="mb-2 px-2 text-xs text-slate-500">
              {user?.name || "Glazia User"}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center rounded-md text-sm font-medium text-slate-800 transition hover:bg-slate-50 hover:text-slate-900",
              collapsed ? "justify-center p-2" : "gap-2 px-2 py-2"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4 text-slate-700" />
            {!collapsed ? <span>Logout</span> : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
