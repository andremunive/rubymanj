import {
  Component,
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

import { ClientListItem } from '../../models/client-list-item.model';
import { ClientsService } from '../../services/clients.service';

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit, OnDestroy {
  items: ClientListItem[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  loading = false;
  error: string | null = null;
  dialogOpen = false;

  readonly pageSizeOptions = [10, 25, 50];
  readonly searchCtrl = new FormControl('');

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly clientsService: ClientsService,
  ) {}

  ngOnInit(): void {
    this.loadClients();

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.page = 1;
        this.loadClients();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ------------------------------------------------------------------ //
  //  Data loading                                                       //
  // ------------------------------------------------------------------ //

  loadClients(): void {
    this.loading = true;
    this.error = null;

    this.clientsService
      .listClients({
        search: this.searchCtrl.value ?? '',
        page: this.page,
        pageSize: this.pageSize,
      })
      .then((result) => {
        this.items = result.items;
        this.total = result.total;
      })
      .catch((err: Error) => {
        this.error = err.message ?? 'Error al cargar las alumnas.';
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
    this.loadClients();
  }

  goToPrevPage(): void {
    if (this.page <= 1) return;
    this.page--;
    this.loadClients();
  }

  goToNextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page++;
    this.loadClients();
  }

  goToLastPage(): void {
    if (this.page === this.totalPages) return;
    this.page = this.totalPages;
    this.loadClients();
  }

  onPageSizeChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    if (isNaN(value)) return;
    this.pageSize = value;
    this.page = 1;
    this.loadClients();
  }

  // ------------------------------------------------------------------ //
  //  Dialog                                                             //
  // ------------------------------------------------------------------ //

  openAddDialog(): void {
    this.dialogOpen = true;
  }

  onDialogClose(): void {
    this.dialogOpen = false;
    // Future: pass result from dialog and reload if a client was created
    // this.loadClients();
  }
}
