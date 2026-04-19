import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  template: `
    <span class="logo" [style.font-size.px]="size" [style.color]="color">
      <span class="logo__text">Rubymanj</span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      letter-spacing: -0.02em;
      font-family: var(--font-sans);
      line-height: 1;
      text-decoration: none;
    }

    .logo__text {
      font-weight: 700;
    }
  `],
})
export class LogoComponent {
  @Input() size = 20;
  @Input() color = '#b95ad3'; // primary-500
}
