import { Injectable } from '@angular/core';
import { AuthError } from '@supabase/supabase-js';
import { BehaviorSubject, Observable, map } from 'rxjs';

import { AppUser, Profile } from '../models/profile.model';
import { UserRole } from '../models/user-role.type';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser$ = new BehaviorSubject<AppUser | null>(null);
  private readonly _sessionReady$ = new BehaviorSubject<boolean>(false);

  /** Emite el usuario autenticado con su perfil, o null si no hay sesión. */
  readonly currentUser$: Observable<AppUser | null> = this._currentUser$.asObservable();

  /**
   * Emite true una vez que la sesión inicial fue resuelta.
   * Los guards deben esperar a esto antes de tomar decisiones de redirección.
   */
  readonly sessionReady$: Observable<boolean> = this._sessionReady$.asObservable();

  /** Rol del usuario actual, derivado de currentUser$. */
  readonly role$: Observable<UserRole | null> = this._currentUser$.pipe(
    map((user) => user?.role ?? null)
  );

  constructor(private readonly supabase: SupabaseService) {
    this.initSession();
  }

  // ------------------------------------------------------------------ //
  //  Inicialización de sesión                                           //
  // ------------------------------------------------------------------ //

  private initSession(): void {
    // onAuthStateChange dispara INITIAL_SESSION al registrarse, así que cubre
    // tanto la rehidratación inicial como los cambios posteriores.
    // El async work va dentro de setTimeout(_, 0) para liberar el lock interno
    // de GoTrue — si se hace await directo de una llamada a la DB dentro del
    // callback, Supabase se bloquea esperando el mismo lock (deadlock conocido).
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        try {
          if (session?.user) {
            await this.hydratarPerfil(session.user.id, session.user.email ?? '');
          } else {
            this._currentUser$.next(null);
          }
        } finally {
          if (!this._sessionReady$.value) {
            this._sessionReady$.next(true);
          }
        }
      }, 0);
    });
  }

  // ------------------------------------------------------------------ //
  //  API pública                                                        //
  // ------------------------------------------------------------------ //

  /**
   * Inicia sesión con email y contraseña.
   * Hidrata el perfil del usuario y emite en currentUser$.
   * Lanza Error con mensaje en español si algo falla.
   */
  async login(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(this.mapearError(error));
    }

    if (data.user) {
      await this.hydratarPerfil(data.user.id, data.user.email ?? '');
    }
  }

  /** Cierra sesión y limpia el estado local. */
  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this._currentUser$.next(null);
  }

  /**
   * Cambia la contraseña del usuario autenticado y marca must_change_password = false.
   * Lanza Error con mensaje en español si algo falla.
   */
  async changePassword(newPassword: string): Promise<void> {
    const { error: authError } = await this.supabase.client.auth.updateUser({
      password: newPassword,
    });

    if (authError) {
      throw new Error(this.mapearError(authError));
    }

    const user = this._currentUser$.value;
    if (!user) {
      throw new Error('No hay sesión activa para actualizar la contraseña.');
    }

    const { error: dbError } = await this.supabase.client
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (dbError) {
      // Advertir pero no bloquear: la contraseña ya fue cambiada en Auth
      console.warn('[AuthService] No se pudo actualizar must_change_password:', dbError.message);
    }

    // Actualizar el estado local
    this._currentUser$.next({ ...user, mustChangePassword: false });
  }

  /** Acceso al usuario actual de forma síncrona (útil en guards). */
  get currentUser(): AppUser | null {
    return this._currentUser$.value;
  }

  /** Indica si la sesión ya fue resuelta de forma síncrona. */
  get sessionReady(): boolean {
    return this._sessionReady$.value;
  }

  // ------------------------------------------------------------------ //
  //  Helpers privados                                                   //
  // ------------------------------------------------------------------ //

  private async hydratarPerfil(userId: string, email: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, role, full_name, email, must_change_password, is_active')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn(
        '[AuthService] No se pudo leer el perfil del usuario. ' +
        'Verifica la anon key y las políticas RLS.',
        error?.message
      );
      this._currentUser$.next(null);
      return;
    }

    const profile = data as {
      id: string;
      role: string;
      full_name: string;
      email: string;
      must_change_password: boolean;
      is_active: boolean;
    };

    const appUser: AppUser = {
      id: profile.id,
      email: profile.email || email,
      role: profile.role as UserRole,
      fullName: profile.full_name,
      mustChangePassword: profile.must_change_password,
      isActive: profile.is_active,
    };

    this._currentUser$.next(appUser);
  }

  private mapearError(error: AuthError): string {
    const msg = error.message?.toLowerCase() ?? '';

    if (msg.includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Tu correo aún no ha sido confirmado.';
    }
    if (msg.includes('too many requests') || msg.includes('rate limit')) {
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.';
    }
    if (msg.includes('password should be')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (msg.includes('same password')) {
      return 'La nueva contraseña no puede ser igual a la actual.';
    }

    return error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
}
