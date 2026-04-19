import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs';

import { RoutineListItem } from '../../models/routine-list-item.model';
import { TrainingsService } from '../../services/trainings.service';

@Component({
  selector: 'app-trainings-list',
  templateUrl: './trainings-list.component.html',
  styleUrls: ['./trainings-list.component.scss'],
})
export class TrainingsListComponent implements OnInit, OnDestroy {
  items: RoutineListItem[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  loading = false;
  error: string | null = null;

  /** ID of the routine whose row-menu is currently open, or null when closed. */
  openMenuRoutineId: string | null = null;

  /** Viewport coordinates for the open menu (fixed-positioned to escape overflow). */
  menuCoords: { top: number; left: number } | null = null;

  readonly pageSizeOptions = [10, 25, 50];
  readonly searchCtrl = new FormControl('');

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly trainingsService: TrainingsService) {}

  ngOnInit(): void {
    this.loadRoutines();

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.page = 1;
        this.loadRoutines();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ------------------------------------------------------------------ //
  //  Data loading                                                       //
  // ------------------------------------------------------------------ //

  loadRoutines(): void {
    this.loading = true;
    this.error = null;

    this.trainingsService
      .listRoutines({
        search: this.searchCtrl.value ?? '',
        page: this.page,
        pageSize: this.pageSize,
      })
      .then((result) => {
        this.items = result.items;
        this.total = result.total;
      })
      .catch((err: Error) => {
        this.error = err.message ?? 'Error al cargar las rutinas.';
      })
      .finally(() => {
        this.loading = false;
      });
  }

  // ------------------------------------------------------------------ //
  //  Pagination                                                         //
  // ------------------------------------------------------------------ //

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get rangeStart(): number {
    if (this.total === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  goToFirstPage(): void {
    if (this.page === 1) return;
    this.page = 1;
    this.loadRoutines();
  }

  goToPrevPage(): void {
    if (this.page <= 1) return;
    this.page--;
    this.loadRoutines();
  }

  goToNextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page++;
    this.loadRoutines();
  }

  goToLastPage(): void {
    if (this.page === this.totalPages) return;
    this.page = this.totalPages;
    this.loadRoutines();
  }

  onPageSizeChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    if (isNaN(value)) return;
    this.pageSize = value;
    this.page = 1;
    this.loadRoutines();
  }

  // ------------------------------------------------------------------ //
  //  Row action menu                                                    //
  // ------------------------------------------------------------------ //

  toggleRowMenu(routineId: string, event: MouseEvent): void {
    event.stopPropagation();

    if (this.openMenuRoutineId === routineId) {
      this.closeRowMenu();
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuCoords = { top: rect.bottom + 4, left: rect.left };
    this.openMenuRoutineId = routineId;
  }

  @HostListener('document:click')
  closeRowMenu(): void {
    this.openMenuRoutineId = null;
    this.menuCoords = null;
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.openMenuRoutineId !== null) {
      this.closeRowMenu();
    }
  }
}
