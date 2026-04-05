"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck, Building2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";

export function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-grid-fade bg-[size:42px_42px] opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.36),transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.22),transparent_30%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-teal-200">
            <Building2 className="h-5 w-5" />
            Glazia ERP
          </div>
          <div className="max-w-xl space-y-6">
            <h1 className="text-5xl font-semibold leading-tight">Quotation-first ERP for modern windows and doors businesses.</h1>
            <p className="text-lg text-slate-300">
              From lead conversion to installation handover, keep pricing, production, inventory, and field teams aligned inside one tenant-aware workspace.
            </p>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            JWT-based access, tenant scoping, and UI-level permissions baked into every workflow.
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] p-6">
        <Card className="w-full max-w-md border-white/50 bg-white/90 shadow-panel">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Access Glazia ERP with your tenant workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue="arjun@glazia.app" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" defaultValue="password" />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setSession({
                  token: "demo-token",
                  user: {
                    id: "usr-1",
                    name: "Arjun Kapoor",
                    email: "arjun@glazia.app",
                    role: "sales_manager",
                    avatarFallback: "AK"
                  },
                  organization: {
                    id: "org-glazia",
                    name: "Glazia Fenestration",
                    shortCode: "GLZ",
                    brandColor: "#0f766e"
                  },
                  permissions: ["quotations.override_pricing", "quotations.approve", "quotations.convert", "crm.manage"]
                });
                router.replace("/dashboard");
              }}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
