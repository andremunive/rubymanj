import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AppUser } from '../../core/models/profile.model';

@Component({
  selector: 'app-layout-trainer',
  templateUrl: './layout-trainer.component.html',
  styleUrls: ['./layout-trainer.component.scss'],
})
export class LayoutTrainerComponent implements OnInit, OnDestroy {
  user: AppUser | null = null;
  sidebarAbierto = true;
  cerrando = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((u) => {
        this.user = u;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidebar(): void {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  cerrarSidebarEnMobile(): void {
    // Solo cerrar en mobile (ancho < 900px)
    if (window.innerWidth < 900) {
      this.sidebarAbierto = false;
    }
  }

  async logout(): Promise<void> {
    if (this.cerrando) return;
    this.cerrando = true;
    try {
      await this.authService.logout();
      await this.router.navigate(['/auth/login']);
    } finally {
      this.cerrando = false;
    }
  }
}
