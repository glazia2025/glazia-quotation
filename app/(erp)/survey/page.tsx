import { ModulePlaceholder } from "@/modules/shared/components/module-placeholder";

export default function SurveyPage() {
  return (
    <ModulePlaceholder
      title="Survey"
      description="Survey tasks, measurement capture, image uploads, and quoted-vs-actual comparison."
      panels={[
        { title: "Survey Tasks", description: "Assignment board for pre-install and measurement visits." },
        { title: "Measurement Input", description: "Room-wise dimension capture with validation flags." },
        { title: "Image Upload", description: "Field images tied to openings and facade locations." }
      ]}
    />
  );
}
