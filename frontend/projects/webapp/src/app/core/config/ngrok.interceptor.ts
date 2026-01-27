import { type HttpInterceptorFn } from '@angular/common/http';

export const ngrokInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('ngrok')) {
    return next(req);
  }

  return next(
    req.clone({
      headers: req.headers.set('ngrok-skip-browser-warning', 'true'),
    }),
  );
};
