import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  sessionReady$!: Observable<boolean>;

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.sessionReady$ = this.authService.sessionReady$;
  }
}
