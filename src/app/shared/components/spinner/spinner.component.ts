import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="spinner"
      role="status"
      aria-label="Cargando"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        class="spinner__track"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="50 80"
        stroke-dashoffset="0"
        class="spinner__arc"
      />
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }

    .spinner {
      animation: spin 0.9s linear infinite;
      color: currentColor;
    }

    .spinner__track {
      opacity: 0.2;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `],
})
export class SpinnerComponent {
  @Input() size = 24;
}
