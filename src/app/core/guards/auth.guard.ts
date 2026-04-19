import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable, filter, map, take } from 'rxjs';

import { AuthService } from '../auth/auth.service';

/**
 * Bloquea rutas si no hay sesión activa.
 * Espera a sessionReady$ = true antes de evaluar para evitar redirecciones prematuras.
 * Guarda la URL original en el query param `returnUrl` para redirigir tras login.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.verificarSesion(state.url);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.verificarSesion(state.url);
  }

  private verificarSesion(url: string): Observable<boolean | UrlTree> {
    return this.authService.sessionReady$.pipe(
      filter((ready) => ready),
      take(1),
      map(() => {
        if (this.authService.currentUser) {
          return true;
        }
        return this.router.createUrlTree(['/auth/login'], {
          queryParams: { returnUrl: url },
        });
      })
    );
  }
}
