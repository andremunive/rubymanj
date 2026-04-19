import { Injectable } from '@angular/core';
import { SupabaseClient, createClient, processLock } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Único lugar en la app que importa @supabase/supabase-js y crea el cliente.
 * Los demás servicios consumen `supabaseService.client`.
 * Los componentes NUNCA inyectan este servicio directamente.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly _client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.anonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // processLock evita el bug de navigator.locks en Firefox tras recargar
        // (el default intenta usar Web Locks API y lanza errores crípticos).
        lock: processLock,
      },
    }
  );

  get client(): SupabaseClient {
    return this._client;
  }
}
