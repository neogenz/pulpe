import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EncryptionBackfillService } from './encryption-backfill.service';
import { EncryptionService } from './encryption.service';

@Injectable()
export class EncryptionBackfillInterceptor implements NestInterceptor {
  readonly #logger = new Logger(EncryptionBackfillInterceptor.name);
  readonly #backfillService: EncryptionBackfillService;
  readonly #encryptionService: EncryptionService;
  readonly #processedUsers = new Set<string>();

  constructor(
    backfillService: EncryptionBackfillService,
    encryptionService: EncryptionService,
  ) {
    this.#backfillService = backfillService;
    this.#encryptionService = encryptionService;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const supabase = request.supabase;

    if (
      !user?.clientKey ||
      !Buffer.isBuffer(user.clientKey) ||
      this.#processedUsers.has(user.id)
    ) {
      return next.handle();
    }

    const clientKeyCopy = Buffer.from(user.clientKey);
    const userId: string = user.id;
    this.#processedUsers.add(userId);

    return next.handle().pipe(
      tap(() => {
        this.#runBackfill(userId, clientKeyCopy, supabase);
      }),
    );
  }

  #runBackfill(userId: string, clientKeyCopy: Buffer, supabase: unknown): void {
    this.#encryptionService
      .ensureUserDEK(userId, clientKeyCopy)
      .then((dek) =>
        this.#backfillService.backfillUserData(
          userId,
          dek,
          supabase as Parameters<
            EncryptionBackfillService['backfillUserData']
          >[2],
        ),
      )
      .catch((error) => {
        this.#processedUsers.delete(userId);
        this.#logger.error(
          {
            userId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Backfill failed, will retry on next request',
        );
      })
      .finally(() => {
        clientKeyCopy.fill(0);
      });
  }
}
