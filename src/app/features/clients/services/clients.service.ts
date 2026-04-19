import { Injectable } from '@angular/core';

import { SupabaseService } from '../../../core/supabase/supabase.service';
import {
  ClientListItem,
  ListClientsParams,
  ListClientsResult,
  PaymentRaw,
  PlanRaw,
  PlanStatus,
  ProfileRaw,
} from '../models/client-list-item.model';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Retrieves a paginated list of clients (profiles with role='client').
   *
   * Uses Supabase's `count: 'exact'` for server-side totals.
   * Joins payments and plans via nested select so we can derive
   * plan status and last payment date on the frontend without an extra RPC.
   *
   * @param params - search term, page (1-based), and pageSize
   * @returns items array and total count for pagination
   */
  async listClients(params: ListClientsParams): Promise<ListClientsResult> {
    const { search, page, pageSize } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase.client
      .from('profiles')
      .select(
        `id,
         full_name,
         email,
         phone,
         created_at,
         is_active,
         payments!payments_client_id_fkey(id, paid_on, due_date, amount, plans(code, name))`,
        { count: 'exact' }
      )
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search && search.trim().length > 0) {
      const term = search.trim();
      query = query.or(
        `full_name.ilike.%${term}%,email.ilike.%${term}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Error al cargar las alumnas: ${error.message}`);
    }

    const items = (data as unknown as ProfileRaw[]).map((row) =>
      this.mapToClientListItem(row)
    );

    return {
      items,
      total: count ?? 0,
    };
  }

  // ------------------------------------------------------------------ //
  //  Private helpers                                                    //
  // ------------------------------------------------------------------ //

  /**
   * Maps a raw Supabase profile row (with nested payments) to
   * a ClientListItem with derived plan status and last payment date.
   */
  private mapToClientListItem(row: ProfileRaw): ClientListItem {
    const payments = row.payments ?? [];

    // Find the payment with the latest due_date to determine current plan status
    const latestByDueDate = this.findLatestPaymentByDueDate(payments);

    // Find the payment with the latest paid_on to show as "last payment"
    const latestByPaidOn = this.findLatestPaymentByPaidOn(payments);

    const currentPlanName =
      (latestByDueDate?.plans as PlanRaw[] | null)?.[0]?.name ?? 'Sin plan';
    const planStatus = this.derivePlanStatus(latestByDueDate);
    const lastPaymentDate = latestByPaidOn?.paid_on ?? null;

    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
      isActive: row.is_active,
      currentPlanName,
      planStatus,
      lastPaymentDate,
    };
  }

  /**
   * Returns the payment with the greatest due_date, or null if no payments.
   * Used to determine the "current" plan and its status.
   */
  private findLatestPaymentByDueDate(payments: PaymentRaw[]): PaymentRaw | null {
    if (payments.length === 0) return null;

    return payments.reduce((latest, current) => {
      return new Date(current.due_date) > new Date(latest.due_date)
        ? current
        : latest;
    });
  }

  /**
   * Returns the payment with the greatest paid_on date, or null if no payments.
   * Used to display "last payment" date in the table.
   */
  private findLatestPaymentByPaidOn(payments: PaymentRaw[]): PaymentRaw | null {
    if (payments.length === 0) return null;

    return payments.reduce((latest, current) => {
      return new Date(current.paid_on) > new Date(latest.paid_on)
        ? current
        : latest;
    });
  }

  /**
   * Derives the plan status from the payment with the latest due_date.
   *
   * Logic:
   * - No payments → 'sin_plan'
   * - MAX(due_date) >= today (in UTC date comparison) → 'al_dia'
   * - MAX(due_date) < today → 'vencido'
   *
   * Note: due_date is stored as a `date` column (no time component).
   * We compare against today's date in America/Bogota timezone to be
   * consistent with the backend's timezone convention.
   */
  private derivePlanStatus(latestPayment: PaymentRaw | null): PlanStatus {
    if (!latestPayment) return 'sin_plan';

    const todayBogota = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    }); // gives 'YYYY-MM-DD'

    return latestPayment.due_date >= todayBogota ? 'al_dia' : 'vencido';
  }
}
