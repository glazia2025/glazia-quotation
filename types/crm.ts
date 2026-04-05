export type LeadStage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface Lead {
  id: string;
  company: string;
  contactName: string;
  phone: string;
  city: string;
  stage: LeadStage;
  potentialValue: number;
  lastActivity: string;
}
