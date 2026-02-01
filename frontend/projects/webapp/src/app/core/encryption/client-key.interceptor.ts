import { inject } from '@angular/core';
import { type HttpInterceptorFn } from '@angular/common/http';

import { ApplicationConfiguration } from '@core/config/application-configuration';

import { ClientKeyService } from './client-key.service';

export const clientKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const clientKeyService = inject(ClientKeyService);
  const config = inject(ApplicationConfiguration);

  const clientKeyHex = clientKeyService.clientKeyHex();

  if (
    !clientKeyHex ||
    !req.url.startsWith(config.backendApiUrl()) ||
    req.headers.has('X-Client-Key')
  ) {
    return next(req);
  }

  const clonedReq = req.clone({
    headers: req.headers.set('X-Client-Key', clientKeyHex),
  });

  return next(clonedReq);
};
