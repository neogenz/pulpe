import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
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
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { EncryptionService } from './encryption.service';
import { EncryptionRekeyService } from './encryption-rekey.service';

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
  readonly #logger = new Logger(EncryptionController.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly rekeyService: EncryptionRekeyService,
  ) {}

  @Get('salt')
  @ApiOperation({ summary: 'Get user encryption salt and KDF parameters' })
  @ApiResponse({
    status: 200,
    description: 'Salt and KDF iterations for client-side key derivation',
  })
  async getSalt(
    @User() user: AuthenticatedUser,
  ): Promise<{ salt: string; kdfIterations: number }> {
    return this.encryptionService.getUserSalt(user.id);
  }

  @Post('password-change')
  @ApiOperation({
    summary: 'Re-encrypt all user data after password change',
  })
  @ApiResponse({
    status: 200,
    description: 'All user data re-encrypted with new key',
  })
  @ApiBadRequestResponse({
    description: 'Invalid new client key',
    type: ErrorResponseDto,
  })
  async onPasswordChange(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Body() body: { newClientKey: string },
  ): Promise<{ success: boolean }> {
    const newKeyBuffer = this.#validateClientKeyHex(body.newClientKey);

    await this.encryptionService.onPasswordChange(
      user.id,
      user.clientKey,
      newKeyBuffer,
      async (oldDek, newDek) => {
        await this.rekeyService.reEncryptAllUserData(
          user.id,
          oldDek,
          newDek,
          supabase,
        );
      },
    );

    this.#logger.log(
      { userId: user.id, operation: 'password_change.complete' },
      'User password change completed with data re-encryption',
    );

    return { success: true };
  }

  @Post('setup-recovery')
  @ApiOperation({ summary: 'Generate a recovery key and wrap the current DEK' })
  @ApiResponse({
    status: 200,
    description:
      'Recovery key generated (shown once, never stored server-side)',
  })
  async setupRecovery(
    @User() user: AuthenticatedUser,
  ): Promise<{ recoveryKey: string }> {
    const { formatted } = await this.encryptionService.setupRecoveryKey(
      user.id,
      user.clientKey,
    );

    this.#logger.log(
      { userId: user.id, operation: 'recovery_key.setup' },
      'Recovery key generated and DEK wrapped',
    );

    return { recoveryKey: formatted };
  }

  @Post('recover')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Recover account using recovery key after password reset',
  })
  @ApiResponse({
    status: 200,
    description: 'Account recovered and data re-encrypted',
  })
  @ApiBadRequestResponse({
    description: 'Invalid recovery key or new client key',
    type: ErrorResponseDto,
  })
  async recover(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Body() body: { recoveryKey: string; newClientKey: string },
  ): Promise<{ success: boolean }> {
    if (!body.recoveryKey) {
      throw new BusinessException(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID);
    }

    const newKeyBuffer = this.#validateClientKeyHex(body.newClientKey);

    try {
      await this.encryptionService.recoverWithKey(
        user.id,
        body.recoveryKey,
        newKeyBuffer,
        async (oldDek, newDek) => {
          await this.rekeyService.reEncryptAllUserData(
            user.id,
            oldDek,
            newDek,
            supabase,
          );
        },
      );
    } catch (error) {
      this.#handleRecoveryError(user.id, error);
    }

    this.#logger.log(
      { userId: user.id, operation: 'recovery.complete' },
      'Account recovered with recovery key',
    );

    return { success: true };
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
    this.#logger.warn(
      {
        userId,
        operation: 'recovery.failed',
        error: error instanceof Error ? error.message : String(error),
      },
      'Recovery attempt failed',
    );

    if (
      error instanceof Error &&
      (error.message.includes('No recovery key configured') ||
        error.message.includes('Invalid recovery key'))
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.RECOVERY_KEY_INVALID);
    }
    throw error;
  }
}
