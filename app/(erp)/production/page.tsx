import { ModulePlaceholder } from "@/modules/shared/components/module-placeholder";

export default function ProductionPage() {
  return (
    <ModulePlaceholder
      title="Production"
      description="Work orders and fabrication stage tracking."
      panels={[
        { title: "Work Orders", description: "Schedule manufacturing batches per order line." },
        { title: "Stage Tracking", description: "Cutting, assembly, glazing, and packing progress." },
        { title: "Bottleneck View", description: "Highlight delayed lines and unplanned dependencies." }
      ]}
    />
  );
}
