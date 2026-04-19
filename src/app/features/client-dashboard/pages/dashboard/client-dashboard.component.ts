import { Component, OnInit } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { AppUser } from '../../../../core/models/profile.model';

@Component({
  selector: 'app-client-dashboard-page',
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.scss'],
})
export class ClientDashboardPageComponent implements OnInit {
  user: AppUser | null = null;

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((u) => {
      this.user = u;
    });
  }
}
