export interface BusinessAccess {
  businessId: string; actorId: string; memberId: string | null;
  isOwner: boolean; name: string; role: string; phoneNumber: string;
  permissions: {
    survey: { enabled: boolean; allQuotations: boolean };
    quotation: { enabled: boolean; allQuotations: boolean };
    orderPlacement: boolean; orderHistory: boolean; inventory: boolean;
  };
}
export function canAccess(access: BusinessAccess | undefined, module: 'survey' | 'quotation' | 'orderPlacement' | 'orderHistory' | 'inventory') {
  if (!access) return false;
  if (access.isOwner) return true;
  const permission = access.permissions[module];
  return typeof permission === 'boolean' ? permission : permission.enabled;
}
