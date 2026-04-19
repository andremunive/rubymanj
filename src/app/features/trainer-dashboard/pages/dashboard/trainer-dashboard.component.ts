import { Component, OnInit } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { AppUser } from '../../../../core/models/profile.model';

@Component({
  selector: 'app-trainer-dashboard-page',
  templateUrl: './trainer-dashboard.component.html',
  styleUrls: ['./trainer-dashboard.component.scss'],
})
export class TrainerDashboardPageComponent implements OnInit {
  user: AppUser | null = null;
  fechaBogota = '';
  horaBogota = '';

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((u) => {
      this.user = u;
    });
    this.actualizarFecha();
  }

  private actualizarFecha(): void {
    const ahora = new Date();
    this.fechaBogota = ahora.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    this.horaBogota = ahora.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
