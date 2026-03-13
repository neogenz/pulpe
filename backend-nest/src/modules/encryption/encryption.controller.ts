import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@common/guards/auth.guard';
import { SkipClientKey } from '@common/decorators/skip-client-key.decorator';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import type { EncryptionChangePinResponse } from 'pulpe-shared';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { EncryptionService } from './encryption.service';
import {
  EncryptionValidateKeyRequestDto,
  EncryptionRecoverRequestDto,
  EncryptionChangePinRequestDto,
  EncryptionVaultStatusResponseDto,
  EncryptionSaltResponseDto,
  EncryptionSetupRecoveryResponseDto,
  EncryptionRecoverResponseDto,
  EncryptionChangePinResponseDto,
} from './dto/encryption-swagger.dto';

const CLIENT_KEY_LENGTH = 32;
const HEX_KEY_REGEX = /^[0-9a-f]{64}$/i;

@ApiTags('Encryption')
@ApiBearerAuth()
@Controller({ path: 'encryption', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class EncryptionController {
  constructor(
    @InjectInfoLogger(EncryptionController.name)
    private readonly logger: InfoLogger,
    private readonly encryptionService: EncryptionService,
  ) {}

  @SkipClientKey()
  @Get('vault-status')
  @ApiOperation({ summary: 'Check if user has a configured vault code' })
  @ApiResponse({
    status: 200,
    description: 'Vault code configuration status',
    type: EncryptionVaultStatusResponseDto,
  })
  async getVaultStatus(@User() user: AuthenticatedUser): Promise<{
    pinCodeConfigured: boolean;
    recoveryKeyConfigured: boolean;
    vaultCodeConfigured: boolean;
  }> {
    return this.encryptionService.getVaultStatus(user.id);
  }

  @SkipClientKey()
  @Get('salt')
  @ApiOperation({ summary: 'Get user encryption salt and KDF parameters' })
  @ApiResponse({
    status: 200,
    description: 'Salt, KDF iterations, and recovery key status',
    type: EncryptionSaltResponseDto,
  })
  async getSalt(
    @User() user: AuthenticatedUser,
  ): Promise<{ salt: string; kdfIterations: number; hasRecoveryKey: boolean }> {
    return this.encryptionService.getUserSalt(user.id);
  }

  @SkipClientKey()
  @Post('validate-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify that a client key can decrypt user data' })
  @ApiResponse({
    status: 204,
    description: 'Client key is valid',
  })
  @ApiBadRequestResponse({
    description: 'Client key verification failed',
    type: ErrorResponseDto,
  })
  async validateKey(
    @User() user: AuthenticatedUser,
    @Body() body: EncryptionValidateKeyRequestDto,
  ): Promise<void> {
    const keyBuffer = this.#validateClientKeyHex(body.clientKey);
    try {
      const isValid = await this.encryptionService.verifyAndEnsureKeyCheck(
        user.id,
        keyBuffer,
      );

      if (!isValid) {
        this.logger.warn(
          { userId: user.id, operation: 'validate_key.failed' },
          'Client key verification failed',
        );
        throw new BusinessException(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
        );
      }
    } finally {
      keyBuffer.fill(0);
    }
  }

  @Post('setup-recovery')
  @HttpCode(HttpStatus.CREATED)
  // 5 req/hour — allows retries if user closes the dialog accidentally
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Generate a recovery key and wrap the current DEK (create-only)',
  })
  @ApiResponse({
    status: 201,
    description:
      'Recovery key generated (shown once, never stored server-side)',
    type: EncryptionSetupRecoveryResponseDto,
  })
  async setupRecovery(
    @User() user: AuthenticatedUser,
  ): Promise<{ recoveryKey: string }> {
    const { formatted } = await this.encryptionService.createRecoveryKey(
      user.id,
      user.clientKey,
    );

    this.logger.info(
      { userId: user.id, operation: 'recovery_key.create' },
      'Recovery key created',
    );

    return { recoveryKey: formatted };
  }

  @Post('regenerate-recovery')
  @HttpCode(HttpStatus.CREATED)
  // 5 req/hour — allows legitimate regeneration (device change, accidental dismiss)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Regenerate recovery key, replacing any existing one',
  })
  @ApiResponse({
    status: 201,
    description:
      'Recovery key regenerated (shown once, never stored server-side)',
    type: EncryptionSetupRecoveryResponseDto,
  })
  async regenerateRecovery(
    @User() user: AuthenticatedUser,
  ): Promise<{ recoveryKey: string }> {
    const { formatted } = await this.encryptionService.regenerateRecoveryKey(
      user.id,
      user.clientKey,
    );

    this.logger.info(
      { userId: user.id, operation: 'recovery_key.regenerate' },
      'Recovery key regenerated',
    );

    return { recoveryKey: formatted };
  }

  @SkipClientKey()
  @Post('recover')
  @HttpCode(HttpStatus.OK)
  // 5 req/hour — allows retries on recovery-key typos without locking the user out
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Recover account using recovery key after password reset',
  })
  @ApiResponse({
    status: 200,
    description: 'Account recovered and data re-encrypted',
    type: EncryptionRecoverResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid recovery key or new client key',
    type: ErrorResponseDto,
  })
  async recover(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Body() body: EncryptionRecoverRequestDto,
  ): Promise<{ success: boolean }> {
    if (!body.recoveryKey?.trim()) {
      throw new BusinessException(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID);
    }

    const newKeyBuffer = this.#validateClientKeyHex(body.newClientKey);

    try {
      await this.encryptionService.recoverWithKey(
        user.id,
        body.recoveryKey,
        newKeyBuffer,
        supabase,
      );
    } catch (error) {
      this.#handleRecoveryError(user.id, error);
    } finally {
      newKeyBuffer.fill(0);
    }

    this.logger.info(
      { userId: user.id, operation: 'recovery.complete' },
      'Account recovered with recovery key',
    );

    return { success: true };
  }

  @SkipClientKey()
  @Post('change-pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Change PIN code and re-encrypt all user data' })
  @ApiResponse({
    status: 200,
    description: 'PIN changed and data re-encrypted',
    type: EncryptionChangePinResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid client key or old PIN verification failed',
    type: ErrorResponseDto,
  })
  async changePin(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Body() body: EncryptionChangePinRequestDto,
  ): Promise<EncryptionChangePinResponse> {
    let oldKeyBuffer: Buffer | undefined;
    let newKeyBuffer: Buffer | undefined;

    try {
      oldKeyBuffer = this.#validateClientKeyHex(body.oldClientKey);
      newKeyBuffer = this.#validateClientKeyHex(body.newClientKey);
      const result = await this.encryptionService.changePinRekey(
        user.id,
        oldKeyBuffer,
        newKeyBuffer,
        supabase,
      );

      this.logger.info(
        {
          userId: user.id,
          operation: 'pin_change.complete',
          recoveryKeyRegenerated: true,
        },
        'PIN changed and data re-encrypted',
      );

      return result;
    } finally {
      oldKeyBuffer?.fill(0);
      newKeyBuffer?.fill(0);
    }
  }

  #validateClientKeyHex(hex: string): Buffer {
    if (!hex || !HEX_KEY_REGEX.test(hex)) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

    const buffer = Buffer.from(hex, 'hex');
    if (
      buffer.length !== CLIENT_KEY_LENGTH ||
      !buffer.some((byte) => byte !== 0)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

    return buffer;
  }

  #handleRecoveryError(userId: string, error: unknown): never {
    if (error instanceof Error) {
      const isRecoveryKeyError =
        error.message.includes('No recovery key configured') ||
        error.message.includes('Invalid recovery key') ||
        error.message.includes('Invalid base32 character') ||
        error.message.includes('Unsupported state or unable to authenticate') ||
        error.message.includes('Unwrapped DEK has invalid length');

      if (isRecoveryKeyError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.RECOVERY_KEY_INVALID,
          undefined,
          { userId, operation: 'recovery.failed' },
          { cause: error },
        );
      }
    }
    throw error;
  }
}
