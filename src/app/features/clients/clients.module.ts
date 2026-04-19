import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';

import { SharedModule } from '../../shared/shared.module';
import { ClientsRoutingModule } from './clients-routing.module';

import { AddStudentDialogComponent } from './components/add-student-dialog/add-student-dialog.component';
import { StatusPillComponent } from './components/status-pill/status-pill.component';
import { ClientsListComponent } from './pages/clients-list/clients-list.component';

@NgModule({
  declarations: [
    ClientsListComponent,
    AddStudentDialogComponent,
    StatusPillComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    A11yModule,
    ClientsRoutingModule,
  ],
})
export class ClientsModule {}
