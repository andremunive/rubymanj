/**
 * Represents a single row in the "Entrenamiento" routines table.
 * When `assignedClientName` is null, the routine works as a reusable template.
 */
export interface RoutineListItem {
  id: string;
  name: string;
  description: string | null;
  assignedClientId: string | null;
  assignedClientName: string | null;
  assignedDate: string | null; // ISO date, set when the routine is assigned to a client
  createdAt: string;           // ISO timestamp
}

export interface ListRoutinesParams {
  search?: string;
  page: number;       // 1-based
  pageSize: number;
}

export interface ListRoutinesResult {
  items: RoutineListItem[];
  total: number;
}
