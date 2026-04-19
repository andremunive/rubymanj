import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { ClientDashboardPageComponent } from './pages/dashboard/client-dashboard.component';

@NgModule({
  declarations: [ClientDashboardPageComponent],
  imports: [
    SharedModule,
    RouterModule.forChild([
      { path: '', component: ClientDashboardPageComponent },
    ]),
  ],
})
export class ClientDashboardModule {}
