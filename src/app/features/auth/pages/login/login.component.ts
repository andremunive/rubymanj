import { Component, AfterViewInit, ElementRef, ViewChild, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss', '../shared/auth-form.scss'],
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild('emailInput') emailInputRef!: ElementRef<HTMLInputElement>;

  form: FormGroup;
  showPassword = false;
  cargando = false;
  errorMensaje = '';

  readonly titulo = 'Bienvenida de vuelta';
  readonly subtitulo = 'El lugar donde construimos juntas tu mejor versión.';

  private returnUrl = '/';

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    // Si ya tiene sesión activa y no necesita cambiar contraseña, redirigir
    const user = this.authService.currentUser;
    if (user) {
      this.redirigirSegunRol(user.role, user.mustChangePassword);
      return;
    }

    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
  }

  ngAfterViewInit(): void {
    // Poner foco en el email para accesibilidad
    setTimeout(() => {
      this.emailInputRef?.nativeElement?.focus();
    }, 100);
  }

  get emailCtrl() { return this.form.get('email')!; }
  get passwordCtrl() { return this.form.get('password')!; }

  get emailError(): string {
    if (!this.emailCtrl.touched || !this.emailCtrl.errors) return '';
    if (this.emailCtrl.errors['required']) return 'El correo es obligatorio.';
    if (this.emailCtrl.errors['email'])    return 'Ingresa un correo válido.';
    return '';
  }

  get passwordError(): string {
    if (!this.passwordCtrl.touched || !this.passwordCtrl.errors) return '';
    if (this.passwordCtrl.errors['required'])  return 'La contraseña es obligatoria.';
    if (this.passwordCtrl.errors['minlength']) return 'La contraseña debe tener al menos 6 caracteres.';
    return '';
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.cargando) return;

    this.cargando = true;
    this.errorMensaje = '';

    try {
      const { email, password } = this.form.value as { email: string; password: string };
      await this.authService.login(email, password);

      const user = this.authService.currentUser;
      if (!user) {
        this.errorMensaje = 'No se pudo obtener el perfil. Revisa la configuración de la app.';
        return;
      }

      this.redirigirSegunRol(user.role, user.mustChangePassword);
    } catch (err: unknown) {
      this.errorMensaje = err instanceof Error ? err.message : 'Error al iniciar sesión.';
    } finally {
      this.cargando = false;
    }
  }

  private redirigirSegunRol(role: string, mustChangePassword: boolean): void {
    if (mustChangePassword) {
      this.router.navigate(['/auth/change-password']);
      return;
    }
    if (this.returnUrl && this.returnUrl !== '/') {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }
    const destino = role === 'trainer' ? '/trainer' : '/client';
    this.router.navigate([destino]);
  }
}
