import { type Provider, type EnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { demoHttpInterceptor } from '../demo/demo-http.interceptor';
import { authInterceptor } from './auth-interceptor';
import { httpErrorInterceptor } from '../analytics/http-error-interceptor';

export function provideAuth(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(
      withInterceptors([
        demoHttpInterceptor, // Demo interceptor must be FIRST to intercept before auth
        authInterceptor,
        httpErrorInterceptor, // Add HTTP error tracking after auth
      ]),
    ),
  ];
}
