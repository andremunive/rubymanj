import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { AlertComponent }   from './components/alert/alert.component';
import { AvatarComponent }  from './components/avatar/avatar.component';
import { ButtonComponent }  from './components/button/button.component';
import { LogoComponent }    from './components/logo/logo.component';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { DateBogotaPipe }   from './pipes/date-bogota.pipe';

@NgModule({
  declarations: [
    AlertComponent,
    AvatarComponent,
    ButtonComponent,
    LogoComponent,
    SpinnerComponent,
    DateBogotaPipe,
  ],
  imports: [CommonModule, ReactiveFormsModule],
  exports: [
    AlertComponent,
    AvatarComponent,
    ButtonComponent,
    LogoComponent,
    SpinnerComponent,
    DateBogotaPipe,
    CommonModule,
    ReactiveFormsModule,
  ],
})
export class SharedModule {}
