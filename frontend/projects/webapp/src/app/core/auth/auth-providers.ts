import { type Provider, type EnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth-interceptor';
import { httpErrorInterceptor } from '../analytics/http-error-interceptor';
import { maintenanceInterceptor } from '../maintenance';

export function provideAuth(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(
      withInterceptors([
        maintenanceInterceptor, // Handle 503 maintenance before auth retry
        authInterceptor,
        httpErrorInterceptor, // Add HTTP error tracking after auth
      ]),
    ),
  ];
}
