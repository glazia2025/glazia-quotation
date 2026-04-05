import { ModulePlaceholder } from "@/modules/shared/components/module-placeholder";

export default function DispatchPage() {
  return (
    <ModulePlaceholder
      title="Dispatch"
      description="Delivery planning and shipment status tracking."
      panels={[
        { title: "Dispatch Planning", description: "Vehicle allocation and route grouping." },
        { title: "Delivery Status", description: "Site-wise dispatch progress and proof of delivery." },
        { title: "Packing Readiness", description: "Items cleared by production for shipment." }
      ]}
    />
  );
}
