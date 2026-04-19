import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { LayoutTrainerComponent } from './layout-trainer.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutTrainerComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('../../features/trainer-dashboard/trainer-dashboard.module').then(
            (m) => m.TrainerDashboardModule
          ),
      },
      {
        path: 'alumnas',
        loadChildren: () =>
          import('../../features/clients/clients.module').then(
            (m) => m.ClientsModule
          ),
      },
      {
        path: 'entrenamiento',
        loadChildren: () =>
          import('../../features/trainings/trainings.module').then(
            (m) => m.TrainingsModule
          ),
      },
    ],
  },
];

@NgModule({
  declarations: [LayoutTrainerComponent],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class LayoutTrainerModule {}
