import { Injectable } from '@angular/core';
import { AuthError, User } from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/supabase.service';

export interface SignInResult {
  ok: boolean;
  user?: User | null;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async signIn(email: string, password: string): Promise<SignInResult> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, message: this.mapError(error) };
    }

    return {
      ok: true,
      user: data.user,
      message: data.user?.email
        ? `Bienvenida, ${data.user.email}.`
        : 'Sesión iniciada correctamente.',
    };
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  private mapError(error: AuthError): string {
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

    return error.message || 'Ocurrió un error al iniciar sesión.';
  }
}
