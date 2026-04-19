import { Component, Input } from '@angular/core';

import { PlanStatus } from '../../models/client-list-item.model';

@Component({
  selector: 'app-status-pill',
  template: `
    <span class="status-pill" [ngClass]="pillClass" [attr.aria-label]="label">
      <span class="status-pill__dot" aria-hidden="true"></span>
      {{ label }}
    </span>
  `,
  styles: [`
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: 0.01em;
    }

    .status-pill__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.7;
      flex-shrink: 0;
    }

    /* Al día */
    .pill--al-dia {
      background-color: #dcfce7;
      color: #15803d;
    }

    /* Vencido */
    .pill--vencido {
      background-color: #fee2e2;
      color: #dc2626;
    }

    /* Sin plan de pago */
    .pill--sin-plan {
      background-color: #f5f4f2;
      color: #57534e;
    }
  `],
})
export class StatusPillComponent {
  @Input() status: PlanStatus = 'sin_plan';

  get label(): string {
    switch (this.status) {
      case 'al_dia':   return 'Al día';
      case 'vencido':  return 'Vencido';
      case 'sin_plan': return 'Sin plan de pago';
    }
  }

  get pillClass(): string {
    switch (this.status) {
      case 'al_dia':   return 'pill--al-dia';
      case 'vencido':  return 'pill--vencido';
      case 'sin_plan': return 'pill--sin-plan';
    }
  }
}
