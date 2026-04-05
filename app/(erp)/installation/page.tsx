import { ModulePlaceholder } from "@/modules/shared/components/module-placeholder";

export default function InstallationPage() {
  return (
    <ModulePlaceholder
      title="Installation"
      description="Schedule installation crews and capture completion progress."
      panels={[
        { title: "Crew Schedule", description: "Assign teams to projects and zones." },
        { title: "Completion Tracker", description: "Opening-wise completion and snag status." },
        { title: "Handover Checklist", description: "Customer sign-off and closure workflow." }
      ]}
    />
  );
}
