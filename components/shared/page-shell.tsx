import { cn } from "@/utils/cn";

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  backButton
}: {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  backButton?: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-4 rounded-3xl bg-white/90 p-6 shadow-panel sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
  {backButton ? (
    <div className="pt-1">
      {backButton}
    </div>
  ) : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div> : null}
      </div>
      <div className={cn("space-y-6", className)}>{children}</div>
    </section>
  );
}
