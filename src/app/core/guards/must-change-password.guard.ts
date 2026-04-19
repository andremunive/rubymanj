import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable, filter, map, take } from 'rxjs';

import { AuthService } from '../auth/auth.service';

/**
 * Si el usuario tiene must_change_password = true y no está en /auth/change-password,
 * lo redirige a esa ruta para forzar el cambio de contraseña antes de continuar.
 */
@Injectable({ providedIn: 'root' })
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.authService.sessionReady$.pipe(
      filter((ready) => ready),
      take(1),
      map(() => {
        const user = this.authService.currentUser;
        if (!user) {
          return this.router.createUrlTree(['/auth/login']);
        }

        const estaEnCambioPassword = state.url.includes('/auth/change-password');

        if (user.mustChangePassword && !estaEnCambioPassword) {
          return this.router.createUrlTree(['/auth/change-password']);
        }

        return true;
      })
    );
  }
}
