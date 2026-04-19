import { Pipe, PipeTransform } from '@angular/core';

/**
 * DateBogotaPipe
 *
 * Formats a date string or Date object as 'DD/MM/YYYY' in the
 * America/Bogota timezone.
 *
 * Decision: Angular's built-in DatePipe formats in the browser's local
 * timezone unless you pass an explicit timezone string. Since the project
 * is always in America/Bogota (per schema.md § 11), we use
 * `toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })` here
 * so that any server-returned ISO timestamp (which Supabase returns in UTC)
 * is interpreted correctly as a Bogota calendar date.
 *
 * Usage: {{ profile.created_at | dateBogota }}
 */
@Pipe({ name: 'dateBogota' })
export class DateBogotaPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';

    const date = typeof value === 'string' ? new Date(value) : value;

    if (isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
