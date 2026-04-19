import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './core/guards/auth.guard';
import { MustChangePasswordGuard } from './core/guards/must-change-password.guard';
import { RoleGuard } from './core/guards/role.guard';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: 'trainer',
    canActivate: [AuthGuard, RoleGuard, MustChangePasswordGuard],
    data: { role: 'trainer' },
    loadChildren: () =>
      import('./layouts/layout-trainer/layout-trainer.module').then(
        (m) => m.LayoutTrainerModule
      ),
  },
  {
    path: 'client',
    canActivate: [AuthGuard, RoleGuard, MustChangePasswordGuard],
    data: { role: 'client' },
    loadChildren: () =>
      import('./layouts/layout-client/layout-client.module').then(
        (m) => m.LayoutClientModule
      ),
  },
  { path: '**', redirectTo: 'auth/login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
