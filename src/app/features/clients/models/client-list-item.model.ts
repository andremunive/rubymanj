/**
 * Represents a single row in the "Mis alumnas" table.
 * Derived from `profiles` joined with `payments` + `plans`.
 */
export interface ClientListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;        // ISO timestamp from profiles.created_at
  isActive: boolean;

  // Derived from payments
  currentPlanName: string;  // Name of plan from latest payment, or 'Sin plan'
  planStatus: PlanStatus;
  lastPaymentDate: string | null; // ISO date string from payments.paid_on, or null
}

export type PlanStatus = 'al_dia' | 'vencido' | 'sin_plan';

/** Shape of a payment row as returned from Supabase nested select.
 *  Note: Supabase returns FK-joined rows as an array even for many-to-one
 *  relations when using the `table(col1, col2)` syntax in the select string.
 */
export interface PaymentRaw {
  id: string;
  paid_on: string;
  due_date: string;
  amount: number;
  plans: PlanRaw[] | null;
}

/** Shape of a plan row as returned from Supabase nested select. */
export interface PlanRaw {
  code: string;
  name: string;
}

/** Shape of a profile row as returned from Supabase. */
export interface ProfileRaw {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  is_active: boolean;
  payments: PaymentRaw[];
}

/** Parameters for the listClients service method. */
export interface ListClientsParams {
  search?: string;
  page: number;       // 1-based
  pageSize: number;
}

/** Return value of the listClients service method. */
export interface ListClientsResult {
  items: ClientListItem[];
  total: number;
}
