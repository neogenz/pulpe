import { Provider, EnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth-interceptor';

export function provideAuth(): (Provider | EnvironmentProviders)[] {
  return [provideHttpClient(withInterceptors([authInterceptor]))];
}
