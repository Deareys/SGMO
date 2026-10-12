import { UserProfile } from '../../types';

/** Selección explícita del DTO público: ningún secreto o campo de control de autenticación sale de la API. */
export function publicProfile(profile: UserProfile): UserProfile {
  return {
    id: profile.id, userCode: profile.userCode, name: profile.name,
    email: profile.email, role: profile.role, phone: profile.phone,
    avatarUrl: profile.avatarUrl, assignedHouseId: profile.assignedHouseId,
    commissionRate: profile.commissionRate, housingCostExempt: profile.housingCostExempt,
    housingCostOverride: profile.housingCostOverride, isActive: profile.isActive,
    notes: profile.notes, permissions: profile.permissions, hasPassword: profile.hasPassword
  };
}
