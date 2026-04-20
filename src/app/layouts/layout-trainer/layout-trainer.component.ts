import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
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
  /** True when the mobile collapsible menu is open. */
  menuAbierto = false;
  /** True when the user dropdown (avatar) is open. */
  userMenuAbierto = false;
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

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    if (this.menuAbierto) this.userMenuAbierto = false;
  }

  cerrarMenu(): void {
    this.menuAbierto = false;
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuAbierto = !this.userMenuAbierto;
    if (this.userMenuAbierto) this.menuAbierto = false;
  }

  @HostListener('document:click')
  cerrarUserMenu(): void {
    this.userMenuAbierto = false;
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
