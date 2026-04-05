import { ModulePlaceholder } from "@/modules/shared/components/module-placeholder";

export default function InvoicesPage() {
  return (
    <ModulePlaceholder
      title="Invoices"
      description="Invoice list and payment tracking UI."
      panels={[
        { title: "Invoice List", description: "Billing records linked to orders and progress stages." },
        { title: "Collections Tracker", description: "Outstanding and paid amount visibility." },
        { title: "Payment Follow-up", description: "Overdue reminders and finance notes." }
      ]}
    />
  );
}
