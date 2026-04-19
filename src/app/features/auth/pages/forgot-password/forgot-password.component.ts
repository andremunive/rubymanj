import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss', '../shared/auth-form.scss'],
})
export class ForgotPasswordComponent {
  form: FormGroup;
  enviado = false;

  constructor(private readonly fb: FormBuilder) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get emailCtrl() { return this.form.get('email')!; }

  get emailError(): string {
    if (!this.emailCtrl.touched || !this.emailCtrl.errors) return '';
    if (this.emailCtrl.errors['required']) return 'El correo es obligatorio.';
    if (this.emailCtrl.errors['email'])    return 'Ingresa un correo válido.';
    return '';
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    // Hook point para el flujo de recuperación con Supabase — se conectará en siguiente fase.
    this.enviado = true;
  }

  reintentar(): void {
    this.enviado = false;
    this.form.reset();
  }
}
