import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { Provider, EnvironmentProviders } from '@angular/core';
import { AuthInterceptor } from './auth-interceptor';

export function provideAuth(): (Provider | EnvironmentProviders)[] {
  return [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ];
}
