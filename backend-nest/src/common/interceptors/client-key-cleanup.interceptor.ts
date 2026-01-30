import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class ClientKeyCleanupInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      finalize(() => {
        const clientKey = context.switchToHttp().getRequest().user?.clientKey;
        if (Buffer.isBuffer(clientKey)) {
          clientKey.fill(0);
        }
      }),
    );
  }
}
