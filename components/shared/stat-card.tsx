import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <Card className="border-0 bg-slate-950 text-white shadow-panel">
      <CardHeader className="pb-3">
        <p className="text-sm text-slate-300">{label}</p>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-emerald-300">{change}</CardContent>
    </Card>
  );
}
