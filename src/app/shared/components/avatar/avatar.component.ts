import { Component, Input } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

/**
 * Renders a circular avatar with the first two initials of `fullName`.
 * Falls back to a neutral user icon when fullName is empty.
 *
 * Sizes: sm = 32px, md = 40px, lg = 56px.
 */
@Component({
  selector: 'app-avatar',
  template: `
    <div
      class="avatar"
      [ngClass]="sizeClass"
      [attr.aria-label]="fullName ? fullName : 'Usuario'"
      role="img"
    >
      <ng-container *ngIf="initials; else iconTpl">
        {{ initials }}
      </ng-container>
      <ng-template #iconTpl>
        <!-- Generic user icon when no name is available -->
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="avatar__fallback-icon"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </ng-template>
    </div>
  `,
  styles: [`
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: #f6e8fb; /* primary-100 */
      color: #8c3da3;            /* primary-700 */
      font-weight: 600;
      letter-spacing: 0.02em;
      flex-shrink: 0;
      user-select: none;
      text-transform: uppercase;
    }

    .avatar--sm {
      width: 32px;
      height: 32px;
      font-size: 11px;
    }

    .avatar--md {
      width: 40px;
      height: 40px;
      font-size: 13px;
    }

    .avatar--lg {
      width: 56px;
      height: 56px;
      font-size: 18px;
    }

    .avatar__fallback-icon {
      width: 55%;
      height: 55%;
      color: #8c3da3; /* primary-700 */
    }
  `],
})
export class AvatarComponent {
  @Input() fullName = '';
  @Input() size: AvatarSize = 'md';

  get initials(): string {
    if (!this.fullName || this.fullName.trim().length === 0) return '';
    const parts = this.fullName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase();
  }

  get sizeClass(): string {
    return `avatar--${this.size}`;
  }
}
