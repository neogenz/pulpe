import { type HttpInterceptorFn } from '@angular/common/http';
import { REQUEST_ID_HEADER } from 'pulpe-shared';

export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(REQUEST_ID_HEADER)) {
    return next(req);
  }

  return next(
    req.clone({
      headers: req.headers.set(REQUEST_ID_HEADER, crypto.randomUUID()),
    }),
  );
};
