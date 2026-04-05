import { ModulePlaceholder } from "@/modules/shared/components/module-placeholder";

export default function OrdersPage() {
  return (
    <ModulePlaceholder
      title="Orders"
      description="Converted quotations, order details, and status tracking."
      panels={[
        { title: "Converted Quotations", description: "Orders generated from approved quotations." },
        { title: "Order Tracker", description: "Execution timeline from commercial sign-off to delivery." },
        { title: "Commercial Summary", description: "Payment schedule and order milestone visibility." }
      ]}
    />
  );
}
