import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TrainingsListComponent } from './pages/trainings-list/trainings-list.component';

const routes: Routes = [
  { path: '', component: TrainingsListComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TrainingsRoutingModule {}
