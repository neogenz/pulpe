import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
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
    if (!body.newClientKey || !HEX_KEY_REGEX.test(body.newClientKey)) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

    const newKeyBuffer = Buffer.from(body.newClientKey, 'hex');
    if (
      newKeyBuffer.length !== CLIENT_KEY_LENGTH ||
      !newKeyBuffer.some((byte) => byte !== 0)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

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
}
