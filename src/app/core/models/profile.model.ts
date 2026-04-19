import { UserRole } from './user-role.type';

/** Espejo del registro en la tabla `profiles` de Supabase. */
export interface Profile {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  notes: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Usuario de la app combinando datos de Auth + Profile.
 * Es lo que se emite en `AuthService.currentUser$`.
 */
export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  mustChangePassword: boolean;
  isActive: boolean;
}
