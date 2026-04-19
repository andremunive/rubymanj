import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable, filter, map, take } from 'rxjs';

import { UserRole } from '../models/user-role.type';
import { AuthService } from '../auth/auth.service';

/**
 * Verifica que el rol del usuario coincida con `route.data.role`.
 * Si no coincide, redirige al dashboard del rol correcto.
 * Requiere que AuthGuard ya haya verificado la sesión.
 */
@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    const requiredRole = route.data['role'] as UserRole;

    return this.authService.sessionReady$.pipe(
      filter((ready) => ready),
      take(1),
      map(() => {
        const user = this.authService.currentUser;
        if (!user) {
          return this.router.createUrlTree(['/auth/login']);
        }

        if (user.role === requiredRole) {
          return true;
        }

        // Redirigir al dashboard del rol correcto
        const destino = user.role === 'trainer' ? '/trainer' : '/client';
        return this.router.createUrlTree([destino]);
      })
    );
  }
}
