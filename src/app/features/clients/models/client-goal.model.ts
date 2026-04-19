/**
 * Training objective assigned to a client.
 * Stored in `profiles.goal` and constrained server-side.
 *
 * Internal codes are in English; UI labels are in Spanish (see GOAL_LABELS).
 */
export type ClientGoal =
  | 'muscle_gain'
  | 'fat_loss'
  | 'body_recomp'
  | 'conditioning'
  | 'maintenance';

/** Ordered list of selectable goals, as they appear in dropdowns. */
export const CLIENT_GOAL_OPTIONS: readonly ClientGoal[] = [
  'muscle_gain',
  'fat_loss',
  'body_recomp',
  'conditioning',
  'maintenance',
] as const;

/** Human-readable Spanish labels for each goal code. */
export const GOAL_LABELS: Readonly<Record<ClientGoal, string>> = {
  muscle_gain:   'Aumento de masa muscular',
  fat_loss:      'Pérdida de grasa',
  body_recomp:   'Recomposición corporal',
  conditioning:  'Acondicionamiento físico',
  maintenance:   'Mantenimiento',
};
