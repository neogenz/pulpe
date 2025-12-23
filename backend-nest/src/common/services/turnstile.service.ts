import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isProductionLike } from '@config/environment';

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
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secretKey: string;
  private readonly skipVerification: boolean;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY', '');
    const nodeEnv = this.configService.get('NODE_ENV');

    // Skip verification in non-production environments (local, test, development)
    this.skipVerification = !isProductionLike(nodeEnv);

    if (this.skipVerification) {
      this.logger.debug(
        `Turnstile verification disabled (NODE_ENV=${nodeEnv})`,
      );
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
      this.logger.log('Empty Turnstile token accepted (rate-limited endpoint)');
      return true;
    }

    if (!this.secretKey) {
      this.logger.error('TURNSTILE_SECRET_KEY not configured');
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
        this.logger.log('Turnstile verification successful', {
          hostname: data.hostname,
        });
        return true;
      }

      this.logger.warn('Turnstile verification failed', {
        errorCodes: data['error-codes'],
      });
      return false;
    } catch (error) {
      this.logger.error('Turnstile verification error', { error });
      return false;
    }
  }
}
