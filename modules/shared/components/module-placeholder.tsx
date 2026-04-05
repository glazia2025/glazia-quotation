import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";

export function ModulePlaceholder({
  title,
  description,
  panels
}: {
  title: string;
  description: string;
  panels: { title: string; description: string }[];
}) {
  return (
    <PageShell title={title} description={description}>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {panels.map((panel) => (
          <Card key={panel.title} className="border-0 bg-white/90">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{panel.title}</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </div>
              <CardDescription>{panel.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl bg-[linear-gradient(180deg,#0f172a_0%,#1e293b_100%)] p-6 text-sm text-slate-200">
                UI shell ready for API wiring and workflow-specific interactions.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
