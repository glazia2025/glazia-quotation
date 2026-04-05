import type { Lead } from "@/types/crm";

export async function getLeads(): Promise<Lead[]> {
  return Promise.resolve([
    {
      id: "LD-1001",
      company: "Skyline Residences",
      contactName: "Raghav Mehta",
      phone: "+91 9876543210",
      city: "Bengaluru",
      stage: "proposal",
      potentialValue: 2250000,
      lastActivity: "2026-04-04T14:30:00.000Z"
    },
    {
      id: "LD-1002",
      company: "Urban Frame Studio",
      contactName: "Mansi Rao",
      phone: "+91 9988776655",
      city: "Hyderabad",
      stage: "qualified",
      potentialValue: 780000,
      lastActivity: "2026-04-05T08:10:00.000Z"
    },
    {
      id: "LD-1003",
      company: "Oakline Villas",
      contactName: "Akhil Nair",
      phone: "+91 9123456780",
      city: "Kochi",
      stage: "negotiation",
      potentialValue: 3150000,
      lastActivity: "2026-04-03T12:00:00.000Z"
    }
  ]);
}
