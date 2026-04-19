import { Injectable } from '@angular/core';

import {
  ListRoutinesParams,
  ListRoutinesResult,
} from '../models/routine-list-item.model';

/**
 * Service that encapsulates all data access for the "Entrenamiento" feature.
 *
 * The routines backend (table + RLS) is not implemented yet, so for now
 * `listRoutines` returns an empty result. When the backend lands, this is
 * the only file that needs to change — the page component will keep working.
 */
@Injectable({ providedIn: 'root' })
export class TrainingsService {
  async listRoutines(_params: ListRoutinesParams): Promise<ListRoutinesResult> {
    return { items: [], total: 0 };
  }
}
