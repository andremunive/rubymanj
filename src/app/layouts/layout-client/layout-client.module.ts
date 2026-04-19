import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { LayoutClientComponent } from './layout-client.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutClientComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('../../features/client-dashboard/client-dashboard.module').then(
            (m) => m.ClientDashboardModule
          ),
      },
    ],
  },
];

@NgModule({
  declarations: [LayoutClientComponent],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class LayoutClientModule {}
