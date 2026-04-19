import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { AuthLayoutComponent } from './components/auth-layout/auth-layout.component';
import { FitnessObjectComponent } from './components/fitness-object/fitness-object.component';
import { RubyWordmarkComponent } from './components/ruby-wordmark/ruby-wordmark.component';
import { ChangePasswordComponent } from './pages/change-password/change-password.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { LoginComponent } from './pages/login/login.component';

@NgModule({
  declarations: [
    AuthLayoutComponent,
    FitnessObjectComponent,
    RubyWordmarkComponent,
    LoginComponent,
    ForgotPasswordComponent,
    ChangePasswordComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule,
    AuthRoutingModule,
  ],
})
export class AuthModule {}
