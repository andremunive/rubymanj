import { Component, Input } from '@angular/core';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-alert',
  template: `
    <div
      class="alert"
      [ngClass]="variantClass"
      role="alert"
    >
      <span *ngIf="showIcon" class="alert__icon" aria-hidden="true">
        <ng-container [ngSwitch]="variant">
          <!-- Info -->
          <svg *ngSwitchCase="'info'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <!-- Success -->
          <svg *ngSwitchCase="'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <!-- Warning -->
          <svg *ngSwitchCase="'warning'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <!-- Danger -->
          <svg *ngSwitchCase="'danger'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </ng-container>
      </span>
      <div class="alert__content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.5;
      border: 1px solid transparent;
    }

    .alert__icon {
      display: inline-flex;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .alert--info    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .alert--success { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
    .alert--warning { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .alert--danger  { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
  `],
})
export class AlertComponent {
  @Input() variant: AlertVariant = 'info';
  @Input() showIcon = true;

  get variantClass(): string {
    return `alert--${this.variant}`;
  }
}
