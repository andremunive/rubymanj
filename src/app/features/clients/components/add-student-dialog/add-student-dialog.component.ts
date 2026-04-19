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

import {
  CLIENT_GOAL_OPTIONS,
  ClientGoal,
  GOAL_LABELS,
} from '../../models/client-goal.model';
import { ClientsService } from '../../services/clients.service';

export interface AddStudentFormValue {
  fullName: string;
  email: string;
  password: string;
  goal: ClientGoal | '';
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

  /** Emits after a client has been successfully created. Parent should reload the list. */
  @Output() readonly created = new EventEmitter<void>();

  form!: FormGroup;
  showPassword = false;
  submitting = false;
  submitError: string | null = null;

  /** Options rendered in the "Objetivo" dropdown. */
  readonly goalOptions = CLIENT_GOAL_OPTIONS.map((code) => ({
    code,
    label: GOAL_LABELS[code],
  }));

  /** ISO date string for today in YYYY-MM-DD used as [max] on the birth-date input. */
  readonly today: string = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Bogota',
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly clientsService: ClientsService,
  ) {}

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
      goal: ['', Validators.required],
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

  get goalCtrl(): AbstractControl {
    return this.form.get('goal')!;
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

  get goalError(): string | null {
    const ctrl = this.goalCtrl;
    if (ctrl.pristine && !this.submitting) return null;
    if (ctrl.hasError('required')) return 'Selecciona un objetivo.';
    return null;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.submitError = null;

    if (this.form.invalid || this.submitting) {
      this.submitting = true;
      return;
    }

    this.submitting = true;
    const value: AddStudentFormValue = this.form.getRawValue();

    this.clientsService
      .createClient({
        fullName: value.fullName,
        email: value.email,
        password: value.password,
        goal: value.goal as ClientGoal,
        phone: value.phone,
        birthDate: value.birthDate,
        notes: value.notes,
      })
      .then(() => {
        this.created.emit();
        this.closeDialog.emit();
      })
      .catch((err: Error) => {
        this.submitError = err.message ?? 'No se pudo crear la alumna.';
      })
      .finally(() => {
        this.submitting = false;
      });
  }

  onCancel(): void {
    if (this.submitting) return;
    this.closeDialog.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.submitting) return;
    // Only close if clicking directly on the backdrop, not on the dialog panel
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.closeDialog.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.submitting) {
      this.closeDialog.emit();
    }
  }
}
