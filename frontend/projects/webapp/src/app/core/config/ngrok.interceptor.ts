import { type HttpInterceptorFn } from '@angular/common/http';
import { NGROK_SKIP_HEADER } from './ngrok.constants';

const NGROK_PATTERN = /\.ngrok(-free)?\.(app|io)/;
const [HEADER_NAME, HEADER_VALUE] = Object.entries(NGROK_SKIP_HEADER)[0];

export const ngrokInterceptor: HttpInterceptorFn = (req, next) => {
  if (!NGROK_PATTERN.test(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      headers: req.headers.set(HEADER_NAME, HEADER_VALUE),
    }),
  );
};
