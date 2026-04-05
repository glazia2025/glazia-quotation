import { LeadDetail } from "@/modules/crm/components/lead-detail";
import { getLeads } from "@/services/crm-service";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leads = await getLeads();
  const lead = leads.find((entry) => entry.id === id);

  return <LeadDetail lead={lead} />;
}
