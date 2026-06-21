export type AppRole = 'admin' | 'staff';

export function canModifyBookings(role: AppRole | null): boolean {
  return role === 'admin';
}

export function canAccessAdminPages(role: AppRole | null): boolean {
  return role === 'admin' || role === 'staff';
}
