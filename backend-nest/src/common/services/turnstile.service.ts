import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isProductionLike } from '@config/environment';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Service for verifying Cloudflare Turnstile tokens
 *
 * Automatically skips verification in non-production environments (local, test, development)
 * In production/preview, validates tokens using Cloudflare's siteverify API
 */
@Injectable()
export class TurnstileService {
  private readonly secretKey: string;
  private readonly skipVerification: boolean;

  constructor(
    @InjectInfoLogger(TurnstileService.name)
    private readonly logger: InfoLogger,
    private readonly configService: ConfigService,
  ) {
    this.secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY', '');
    const nodeEnv = this.configService.get('NODE_ENV');

    // Skip verification in non-production environments (local, test, development)
    this.skipVerification = !isProductionLike(nodeEnv);

    if (this.skipVerification) {
      this.logger.debug({ nodeEnv }, 'Turnstile verification disabled');
    }
  }

  /**
   * Verify a Turnstile token
   *
   * @param token - The Turnstile response token from the client
   * @param ip - Optional client IP address for additional validation
   * @returns true if verification succeeds or is skipped, false otherwise
   */
  async verify(token: string, ip?: string): Promise<boolean> {
    if (this.skipVerification) {
      this.logger.debug('Turnstile verification skipped (non-production)');
      return true;
    }

    if (!token) {
      this.logger.info(
        {},
        'Empty Turnstile token accepted (rate-limited endpoint)',
      );
      return true;
    }

    if (!this.secretKey) {
      this.logger.warn({}, 'TURNSTILE_SECRET_KEY not configured');
      return false;
    }

    return this.verifyWithCloudflare(token, ip);
  }

  private async verifyWithCloudflare(
    token: string,
    ip?: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: this.secretKey,
            response: token,
            remoteip: ip,
          }),
        },
      );

      const data = (await response.json()) as TurnstileVerifyResponse;

      if (data.success) {
        this.logger.info(
          { hostname: data.hostname },
          'Turnstile verification successful',
        );
        return true;
      }

      this.logger.warn(
        { errorCodes: data['error-codes'] },
        'Turnstile verification failed',
      );
      return false;
    } catch (error) {
      this.logger.warn({ err: error }, 'Turnstile verification error');
      return false;
    }
  }
}
