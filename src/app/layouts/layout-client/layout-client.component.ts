import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AppUser } from '../../core/models/profile.model';

/**
 * Layout para clientes — mobile-first.
 * En mobile (< 768px): bottom nav fijo + header simple.
 * En desktop (>= 768px): sidebar lateral en lugar del bottom nav,
 *   contenido centrado a max-width 480px.
 *
 * Decisión de diseño: en desktop se usa sidebar en vez de bottom nav
 * porque el bottom nav a ancho completo resulta extraño y las áreas
 * de clic son pequeñas con un mouse. El sidebar en desktop mejora la
 * usabilidad sin romper la experiencia mobile-first.
 */
@Component({
  selector: 'app-layout-client',
  templateUrl: './layout-client.component.html',
  styleUrls: ['./layout-client.component.scss'],
})
export class LayoutClientComponent implements OnInit, OnDestroy {
  user: AppUser | null = null;
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
