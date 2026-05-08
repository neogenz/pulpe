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
import {
  EncryptionValidateKeyRequestDto,
  EncryptionRecoverRequestDto,
  EncryptionVerifyRecoveryKeyRequestDto,
  EncryptionChangePinRequestDto,
  EncryptionVaultStatusResponseDto,
  EncryptionSaltResponseDto,
  EncryptionSetupRecoveryResponseDto,
  EncryptionRecoverResponseDto,
  EncryptionChangePinResponseDto,
} from './dto/encryption-swagger.dto';
import { GetVaultStatusUseCase } from '../../application/get-vault-status.use-case';
import { GetUserSaltUseCase } from '../../application/get-user-salt.use-case';
import { ValidateUserKeyUseCase } from '../../application/validate-user-key.use-case';
import { SetupRecoveryKeyUseCase } from '../../application/setup-recovery-key.use-case';
import { RegenerateRecoveryKeyUseCase } from '../../application/regenerate-recovery-key.use-case';
import { VerifyRecoveryKeyUseCase } from '../../application/verify-recovery-key.use-case';
import { RecoverWithRecoveryKeyUseCase } from '../../application/recover-with-recovery-key.use-case';
import { ChangePinUseCase } from '../../application/change-pin.use-case';

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
    private readonly getVaultStatusUseCase: GetVaultStatusUseCase,
    private readonly getUserSaltUseCase: GetUserSaltUseCase,
    private readonly validateUserKeyUseCase: ValidateUserKeyUseCase,
    private readonly setupRecoveryKeyUseCase: SetupRecoveryKeyUseCase,
    private readonly regenerateRecoveryKeyUseCase: RegenerateRecoveryKeyUseCase,
    private readonly verifyRecoveryKeyUseCase: VerifyRecoveryKeyUseCase,
    private readonly recoverWithRecoveryKeyUseCase: RecoverWithRecoveryKeyUseCase,
    private readonly changePinUseCase: ChangePinUseCase,
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
    return this.getVaultStatusUseCase.execute(user.id);
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
    return this.getUserSaltUseCase.execute(user.id);
  }

  @SkipClientKey()
  @Post('validate-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
      await this.validateUserKeyUseCase.execute(user.id, keyBuffer);
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
    return this.setupRecoveryKeyUseCase.execute(user.id, user.clientKey);
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
    return this.regenerateRecoveryKeyUseCase.execute(user.id, user.clientKey);
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
      await this.recoverWithRecoveryKeyUseCase.execute(
        user.id,
        body.recoveryKey,
        newKeyBuffer,
        supabase,
      );
    } finally {
      newKeyBuffer.fill(0);
    }

    return { success: true };
  }

  @SkipClientKey()
  @Post('verify-recovery-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Read-only unwrap — same ceiling as validate-key so users can retry after typos
  // (unlike /recover which re-encrypts all data and stays at 5/hour)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify recovery key matches stored wrapped DEK (read-only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Recovery key is valid',
  })
  @ApiBadRequestResponse({
    description: 'Invalid recovery key or no recovery key configured',
    type: ErrorResponseDto,
  })
  async verifyRecoveryKey(
    @User() user: AuthenticatedUser,
    @Body() body: EncryptionVerifyRecoveryKeyRequestDto,
  ): Promise<void> {
    await this.verifyRecoveryKeyUseCase.execute(user.id, body.recoveryKey);
  }

  /**
   * PIN length (exactly 4 digits) is enforced client-side before PBKDF2 derivation.
   * The backend only receives hex-encoded derived keys (64 chars) validated by
   * {@link #validateClientKeyHex}. No raw PIN digits ever reach the server.
   */
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
      return await this.changePinUseCase.execute(
        user.id,
        oldKeyBuffer,
        newKeyBuffer,
        supabase,
      );
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
}
