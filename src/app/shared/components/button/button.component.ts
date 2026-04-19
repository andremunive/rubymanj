import { Component, Input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [attr.aria-disabled]="disabled || loading"
      class="btn"
      [ngClass]="[variantClass, sizeClass]"
    >
      <app-spinner *ngIf="loading" [size]="spinnerSize" class="btn__spinner"></app-spinner>
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    :host { display: inline-block; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: var(--font-sans);
      font-weight: 600;
      border: none;
      cursor: pointer;
      border-radius: 12px;
      transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
      position: relative;
      overflow: hidden;
      white-space: nowrap;
    }

    /* Tamaños */
    .btn--sm { padding: 8px 14px;  font-size: 13px; border-radius: 8px; }
    .btn--md { padding: 12px 20px; font-size: 15px; border-radius: 12px; }
    .btn--lg { padding: 16px 28px; font-size: 16px; border-radius: 14px; }

    /* Variantes */
    .btn--primary {
      color: #fff;
      background: linear-gradient(180deg, #e695f5 0%, #cb6ce6 60%, #a044c4 100%);
      box-shadow: 0 4px 12px -4px rgba(107, 45, 135, 0.4);
    }
    .btn--primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 16px -4px rgba(107, 45, 135, 0.45);
    }
    .btn--primary:active:not(:disabled) {
      transform: translateY(1px);
      box-shadow: 0 2px 6px -2px rgba(107, 45, 135, 0.3);
    }

    .btn--secondary {
      color: #6b2d87;
      background: #fff;
      border: 1.5px solid #ecd9f2;
      box-shadow: 0 2px 6px -2px rgba(107, 45, 135, 0.12);
    }
    .btn--secondary:hover:not(:disabled) {
      transform: translateY(-1px);
      background: #fbf4fd;
    }

    .btn--ghost {
      color: #6b2d87;
      background: transparent;
      border: none;
    }
    .btn--ghost:hover:not(:disabled) {
      background: rgba(203, 108, 230, 0.08);
    }

    .btn--danger {
      color: #fff;
      background: #dc2626;
      box-shadow: 0 4px 12px -4px rgba(220, 38, 38, 0.35);
    }
    .btn--danger:hover:not(:disabled) {
      transform: translateY(-1px);
      background: #b91c1c;
    }

    /* Estado deshabilitado */
    .btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
      transform: none !important;
    }

    /* Focus visible accesible */
    .btn:focus-visible {
      outline: 3px solid rgba(203, 108, 230, 0.45);
      outline-offset: 2px;
    }

    .btn__spinner {
      color: currentColor;
    }
  `],
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() loading = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  get variantClass(): string { return `btn--${this.variant}`; }
  get sizeClass(): string    { return `btn--${this.size}`; }
  get spinnerSize(): number  { return this.size === 'sm' ? 14 : this.size === 'lg' ? 20 : 16; }
}
