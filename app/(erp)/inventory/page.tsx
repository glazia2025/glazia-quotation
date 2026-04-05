import { ModulePlaceholder } from "@/modules/shared/components/module-placeholder";

export default function InventoryPage() {
  return (
    <ModulePlaceholder
      title="Inventory"
      description="Stock list, inward/outward movements, and warehouse visibility."
      panels={[
        { title: "Stock Ledger", description: "Material availability by series, glass, and hardware." },
        { title: "Warehouse View", description: "Rack-wise view of incoming and outgoing stock." },
        { title: "Movement Register", description: "Inward, outward, and reservation transactions." }
      ]}
    />
  );
}
