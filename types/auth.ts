export type Permission =
  | "quotations.override_pricing"
  | "quotations.approve"
  | "quotations.convert"
  | "crm.manage"
  | "production.manage"
  | "dispatch.manage";

export type UserRole = "admin" | "sales_manager" | "sales_exec" | "surveyor" | "production";

export interface Organization {
  id: string;
  name: string;
  brandColor: string;
  shortCode: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarFallback: string;
}
