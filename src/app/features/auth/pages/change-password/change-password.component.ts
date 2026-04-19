import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';

/** Validador custom: la contraseña debe tener al menos una mayúscula y un número. */
function passwordFuerteValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const valor = control.value as string;
    if (!valor) return null;
    const tieneMayuscula = /[A-Z]/.test(valor);
    const tieneNumero   = /[0-9]/.test(valor);
    if (tieneMayuscula && tieneNumero) return null;
    return {
      passwordDebil: {
        tieneMayuscula,
        tieneNumero,
      },
    };
  };
}

/** Validador de grupo: confirmar-password debe coincidir con nueva-password. */
function confirmarPasswordValidator(group: AbstractControl) {
  const nueva    = group.get('nueva')?.value as string;
  const confirmar = group.get('confirmar')?.value as string;
  if (!nueva || !confirmar) return null;
  return nueva === confirmar ? null : { noCoinciden: true };
}

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss', '../shared/auth-form.scss'],
})
export class ChangePasswordComponent implements OnInit, AfterViewInit {
  @ViewChild('nuevaInput') nuevaInputRef!: ElementRef<HTMLInputElement>;

  form: FormGroup;
  mostrarNueva     = false;
  mostrarConfirmar = false;
  guardando        = false;
  errorMensaje     = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.form = this.fb.group(
      {
        nueva:     ['', [Validators.required, Validators.minLength(8), passwordFuerteValidator()]],
        confirmar: ['', [Validators.required]],
      },
      { validators: confirmarPasswordValidator }
    );
  }

  ngOnInit(): void {
    const user = this.authService.currentUser;

    // Sin sesión → login
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Si ya cambió la contraseña, no debería estar aquí
    if (!user.mustChangePassword) {
      const destino = user.role === 'trainer' ? '/trainer' : '/client';
      this.router.navigate([destino]);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.nuevaInputRef?.nativeElement?.focus();
    }, 100);
  }

  get nuevaCtrl()    { return this.form.get('nueva')!; }
  get confirmarCtrl() { return this.form.get('confirmar')!; }

  get nuevaError(): string {
    if (!this.nuevaCtrl.touched || !this.nuevaCtrl.errors) return '';
    if (this.nuevaCtrl.errors['required'])     return 'La contraseña es obligatoria.';
    if (this.nuevaCtrl.errors['minlength'])    return 'Debe tener al menos 8 caracteres.';
    if (this.nuevaCtrl.errors['passwordDebil']) {
      const { tieneMayuscula, tieneNumero } = this.nuevaCtrl.errors['passwordDebil'] as {
        tieneMayuscula: boolean;
        tieneNumero: boolean;
      };
      if (!tieneMayuscula && !tieneNumero) return 'Debe incluir al menos una mayúscula y un número.';
      if (!tieneMayuscula) return 'Debe incluir al menos una letra mayúscula.';
      if (!tieneNumero)    return 'Debe incluir al menos un número.';
    }
    return '';
  }

  get confirmarError(): string {
    if (!this.confirmarCtrl.touched) return '';
    if (this.confirmarCtrl.errors?.['required']) return 'Confirma tu contraseña.';
    if (this.form.errors?.['noCoinciden'] && this.confirmarCtrl.touched) {
      return 'Las contraseñas no coinciden.';
    }
    return '';
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando) return;

    this.guardando    = true;
    this.errorMensaje = '';

    try {
      const { nueva } = this.form.value as { nueva: string };
      await this.authService.changePassword(nueva);

      const user = this.authService.currentUser;
      const destino = user?.role === 'trainer' ? '/trainer' : '/client';
      await this.router.navigate([destino]);
    } catch (err: unknown) {
      this.errorMensaje = err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.';
    } finally {
      this.guardando = false;
    }
  }
}
