"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
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

import { cn } from "@/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/crm/leads", label: "CRM", icon: ContactRound },
  { href: "/quotations", label: "Quotations", icon: ClipboardPenLine },
  { href: "/settings", label: "Global settings", icon: Settings },
 
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/50 bg-slate-950 px-5 py-6 text-white lg:block">
      <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/20">
          <SendToBack className="h-5 w-5 text-teal-200" />
        </div>
        <div>
          <div className="text-sm uppercase tracking-[0.24em] text-teal-200">Glazia</div>
          <div className="font-medium">Fenestration ERP</div>
        </div>
      </div>
      <nav className="mt-8 space-y-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white",
                active && "bg-white text-slate-950 shadow-sm"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
