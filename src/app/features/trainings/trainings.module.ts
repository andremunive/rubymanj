import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { TrainingsRoutingModule } from './trainings-routing.module';

import { TrainingsListComponent } from './pages/trainings-list/trainings-list.component';

@NgModule({
  declarations: [TrainingsListComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    TrainingsRoutingModule,
  ],
})
export class TrainingsModule {}
