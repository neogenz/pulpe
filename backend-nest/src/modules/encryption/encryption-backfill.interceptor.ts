import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SKIP_CLIENT_KEY } from '@common/decorators/skip-client-key.decorator';
import { EncryptionBackfillService } from './encryption-backfill.service';
import { EncryptionService } from './encryption.service';

const PROCESSED_USER_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_USERS = 1000;

@Injectable()
export class EncryptionBackfillInterceptor implements NestInterceptor {
  readonly #logger = new Logger(EncryptionBackfillInterceptor.name);
  readonly #reflector: Reflector;
  readonly #backfillService: EncryptionBackfillService;
  readonly #encryptionService: EncryptionService;
  readonly #processedUsers = new Map<string, number>();

  constructor(
    reflector: Reflector,
    backfillService: EncryptionBackfillService,
    encryptionService: EncryptionService,
  ) {
    this.#reflector = reflector;
    this.#backfillService = backfillService;
    this.#encryptionService = encryptionService;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipClientKey = this.#reflector.getAllAndOverride<boolean>(
      SKIP_CLIENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipClientKey) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const supabase = request.supabase;
    const userId: string | undefined = user?.id;

    this.#pruneProcessedUsers();

    if (
      !user?.clientKey ||
      !Buffer.isBuffer(user.clientKey) ||
      !userId ||
      this.#isUserRecentlyProcessed(userId)
    ) {
      return next.handle();
    }

    const clientKeyCopy = Buffer.from(user.clientKey);
    this.#trackProcessedUser(userId);

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

  #isUserRecentlyProcessed(userId: string): boolean {
    const expiry = this.#processedUsers.get(userId);
    if (!expiry) return false;

    if (expiry <= Date.now()) {
      this.#processedUsers.delete(userId);
      return false;
    }

    return true;
  }

  #trackProcessedUser(userId: string): void {
    // Bounded cache: keep only recently processed users to avoid unbounded memory growth.
    if (this.#processedUsers.has(userId)) {
      this.#processedUsers.delete(userId);
    }

    this.#processedUsers.set(userId, Date.now() + PROCESSED_USER_TTL_MS);

    if (this.#processedUsers.size > MAX_TRACKED_USERS) {
      const oldestUserId = this.#processedUsers.keys().next().value;
      if (oldestUserId) {
        this.#processedUsers.delete(oldestUserId);
      }
    }
  }

  #pruneProcessedUsers(): void {
    const now = Date.now();
    for (const [userId, expiry] of this.#processedUsers) {
      if (expiry <= now) {
        this.#processedUsers.delete(userId);
      }
    }
  }
}
