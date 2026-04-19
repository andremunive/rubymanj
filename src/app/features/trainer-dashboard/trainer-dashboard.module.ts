import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { TrainerDashboardPageComponent } from './pages/dashboard/trainer-dashboard.component';

@NgModule({
  declarations: [TrainerDashboardPageComponent],
  imports: [
    SharedModule,
    RouterModule.forChild([
      { path: '', component: TrainerDashboardPageComponent },
    ]),
  ],
})
export class TrainerDashboardModule {}
