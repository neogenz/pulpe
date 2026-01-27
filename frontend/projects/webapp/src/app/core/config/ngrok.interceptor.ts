import { type HttpInterceptorFn } from '@angular/common/http';

const NGROK_PATTERN = /\.ngrok(-free)?\.app/;

export const ngrokInterceptor: HttpInterceptorFn = (req, next) => {
  if (!NGROK_PATTERN.test(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      headers: req.headers.set('ngrok-skip-browser-warning', 'true'),
    }),
  );
};
