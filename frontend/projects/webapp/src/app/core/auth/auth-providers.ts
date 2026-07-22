import { type Provider, type EnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { clientKeyInterceptor } from '@core/encryption';

import { authInterceptor } from './auth-interceptor';
import { httpErrorInterceptor } from '../analytics/http-error-interceptor';
import { requestIdInterceptor } from '../analytics/request-id-interceptor';
import { maintenanceInterceptor } from '../maintenance';
import { ngrokInterceptor } from '../config/ngrok.interceptor';

export function provideAuth(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(
      withInterceptors([
        requestIdInterceptor, // Attach X-Request-Id correlation header before all other interceptors
        ngrokInterceptor, // Skip ngrok browser warning when tunneling
        maintenanceInterceptor, // Handle 503 maintenance before auth retry
        authInterceptor,
        clientKeyInterceptor, // Add X-Client-Key header for encryption
        httpErrorInterceptor, // Add HTTP error tracking after auth
      ]),
    ),
  ];
}
