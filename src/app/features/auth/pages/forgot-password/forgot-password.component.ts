import { Component } from '@angular/core';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss', '../shared/auth-form.scss'],
})
export class ForgotPasswordComponent {
  email = '';
  sent = false;

  onSubmit(): void {
    if (!this.email) {
      return;
    }
    // Hook point for the real password-recovery flow (Supabase) — wired later.
    this.sent = true;
  }

  reset(): void {
    this.sent = false;
    this.email = '';
  }
}
