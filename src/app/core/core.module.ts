import { CommonModule } from '@angular/common';
import { NgModule, Optional, SkipSelf } from '@angular/core';

/**
 * CoreModule importa y provee los singletons de la app (servicios, guards).
 * SOLO debe importarse en AppModule — no en feature modules.
 */
@NgModule({
  imports: [CommonModule],
  providers: [
    // Los servicios usan providedIn: 'root', así que no se registran aquí explícitamente.
    // Este módulo existe para hacer el guard de "cargado dos veces" y agrupar imports futuros.
  ],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error(
        'CoreModule ya está cargado. Impórtalo solo en AppModule.'
      );
    }
  }
}
