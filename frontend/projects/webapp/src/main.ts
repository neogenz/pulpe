import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from '@app/app.config';
import { App } from '@app/app';
import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { environment } from '@env/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(App, {
  ...appConfig,
  providers: [provideZoneChangeDetection(), ...appConfig.providers],
}).catch((err) => console.error(err));
