import { Component } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss', '../shared/auth-form.scss'],
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  remember = true;
  loading = false;

  readonly heading = 'Bienvenida de vuelta';
  readonly subheading = 'El lugar donde construimos juntas tu mejor versión.';

  constructor(private readonly auth: AuthService) {}

  async onSubmit(): Promise<void> {
    if (this.loading) {
      return;
    }
    if (!this.email || !this.password) {
      alert('Ingresa tu correo y contraseña.');
      return;
    }

    this.loading = true;
    try {
      const result = await this.auth.signIn(this.email, this.password);
      if (result.ok) {
        alert(`✓ Login exitoso\n${result.message}`);
      } else {
        alert(`✗ No se pudo iniciar sesión\n${result.message}`);
      }
    } finally {
      this.loading = false;
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleRemember(): void {
    this.remember = !this.remember;
  }
}
