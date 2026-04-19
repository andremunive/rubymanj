import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthRoutingModule } from './auth-routing.module';
import { AuthLayoutComponent } from './components/auth-layout/auth-layout.component';
import { FitnessObjectComponent } from './components/fitness-object/fitness-object.component';
import { RubyWordmarkComponent } from './components/ruby-wordmark/ruby-wordmark.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { LoginComponent } from './pages/login/login.component';

@NgModule({
  declarations: [
    AuthLayoutComponent,
    FitnessObjectComponent,
    RubyWordmarkComponent,
    LoginComponent,
    ForgotPasswordComponent,
  ],
  imports: [CommonModule, FormsModule, AuthRoutingModule],
})
export class AuthModule {}
