import {
  Component,
  EventEmitter,
  OnInit,
  Output,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';

export interface AddStudentFormValue {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  birthDate: string;
  notes: string;
}

@Component({
  selector: 'app-add-student-dialog',
  templateUrl: './add-student-dialog.component.html',
  styleUrls: ['./add-student-dialog.component.scss'],
})
export class AddStudentDialogComponent implements OnInit {
  /** Emits when the user requests to close the dialog (cancel / X button / backdrop). */
  @Output() readonly closeDialog = new EventEmitter<void>();

  form!: FormGroup;
  showPassword = false;
  submitting = false;

  /** ISO date string for today in YYYY-MM-DD used as [max] on the birth-date input. */
  readonly today: string = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Bogota',
  });

  constructor(private readonly fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      fullName: [
        '',
        [Validators.required, Validators.minLength(3)],
      ],
      email: [
        '',
        [Validators.required, Validators.email],
      ],
      password: [
        '',
        [Validators.required, Validators.minLength(6)],
      ],
      phone: [''],
      birthDate: [''],
      notes: [''],
    });
  }

  // ---- Convenience getters for template ----

  get fullNameCtrl(): AbstractControl {
    return this.form.get('fullName')!;
  }

  get emailCtrl(): AbstractControl {
    return this.form.get('email')!;
  }

  get passwordCtrl(): AbstractControl {
    return this.form.get('password')!;
  }

  get fullNameError(): string | null {
    const ctrl = this.fullNameCtrl;
    if (ctrl.pristine && !this.submitting) return null;
    if (ctrl.hasError('required')) return 'El nombre es obligatorio.';
    if (ctrl.hasError('minlength')) return 'El nombre debe tener al menos 3 caracteres.';
    return null;
  }

  get emailError(): string | null {
    const ctrl = this.emailCtrl;
    if (ctrl.pristine && !this.submitting) return null;
    if (ctrl.hasError('required')) return 'El correo es obligatorio.';
    if (ctrl.hasError('email')) return 'Ingresa un correo válido.';
    return null;
  }

  get passwordError(): string | null {
    const ctrl = this.passwordCtrl;
    if (ctrl.pristine && !this.submitting) return null;
    if (ctrl.hasError('required')) return 'La contraseña es obligatoria.';
    if (ctrl.hasError('minlength')) return 'La contraseña debe tener al menos 6 caracteres.';
    return null;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.submitting = true;
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const value: AddStudentFormValue = this.form.getRawValue();

    // TODO: conectar al RPC trainer_create_client
    // Cuando se implemente: this.clientsService.createClient(value)
    console.log('TODO submit — trainer_create_client payload:', value);

    this.closeDialog.emit();
  }

  onCancel(): void {
    this.closeDialog.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    // Only close if clicking directly on the backdrop, not on the dialog panel
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.closeDialog.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeDialog.emit();
    }
  }
}
