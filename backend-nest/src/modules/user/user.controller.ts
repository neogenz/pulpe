import { Controller, Get, Put, Delete, Body, UseGuards } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import {
  SupabaseService,
  type AuthenticatedSupabaseClient,
} from '@modules/supabase/supabase.service';
import {
  UpdateProfileDto,
  UserProfileResponseDto,
  UpdateUserSettingsDto,
  UserSettingsResponseDto,
  DeleteAccountResponseDto,
} from './dto/user-profile.dto';
import { payDayOfMonthSchema, supportedCurrencySchema } from 'pulpe-shared';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';

@ApiTags('User')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class UserController {
  constructor(
    @InjectInfoLogger(UserController.name)
    private readonly logger: InfoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieves the profile information of the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: UserProfileResponseDto,
  })
  async getProfile(
    @User() user: AuthenticatedUser,
  ): Promise<UserProfileResponseDto> {
    return {
      success: true as const,
      user: {
        id: user.id,
        email: user.email,
        ...(user.firstName && { firstName: user.firstName }),
        ...(user.lastName && { lastName: user.lastName }),
      },
    };
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Updates the first name and last name of the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserProfileResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async updateProfile(
    @Body() updateData: UpdateProfileDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<UserProfileResponseDto> {
    try {
      const updatedUser = await this.performProfileUpdate(updateData, supabase);
      return this.buildProfileResponse(updatedUser);
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.USER_PROFILE_UPDATE_FAILED,
        undefined,
        { operation: 'updateProfile', userId: user.id },
      );
    }
  }

  private async performProfileUpdate(
    updateData: UpdateProfileDto,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data: updatedUser, error } = await supabase.auth.updateUser({
      data: {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
      },
    });

    if (error || !updatedUser.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_PROFILE_UPDATE_FAILED,
        undefined,
        undefined,
        { cause: error },
      );
    }

    return updatedUser;
  }

  private buildProfileResponse(updatedUser: {
    user: {
      id: string;
      email?: string;
      user_metadata?: { firstName?: string; lastName?: string };
    };
  }): UserProfileResponseDto {
    return {
      success: true as const,
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email ?? '',
        ...(updatedUser.user.user_metadata?.firstName && {
          firstName: updatedUser.user.user_metadata.firstName,
        }),
        ...(updatedUser.user.user_metadata?.lastName && {
          lastName: updatedUser.user.user_metadata.lastName,
        }),
      },
    };
  }

  private async getCurrentUserData(supabase: AuthenticatedSupabaseClient) {
    const { data: currentUserData, error: getUserError } =
      await supabase.auth.getUser();

    if (getUserError || !currentUserData.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_FETCH_FAILED,
        undefined,
        undefined,
        { cause: getUserError },
      );
    }

    return currentUserData;
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Get user settings',
    description:
      'Retrieves the current settings for the user (e.g., payDayOfMonth)',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings retrieved successfully',
    type: UserSettingsResponseDto,
  })
  async getSettings(
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<UserSettingsResponseDto> {
    try {
      const currentUserData = await this.getCurrentUserData(supabase);
      const rawPayDay = currentUserData.user.user_metadata?.payDayOfMonth;
      const parsedPayDay = payDayOfMonthSchema.safeParse(rawPayDay);
      const payDayOfMonth = parsedPayDay.success ? parsedPayDay.data : null;

      const rawCurrency = currentUserData.user.user_metadata?.currency;
      const parsedCurrency = supportedCurrencySchema.safeParse(rawCurrency);
      const currency = parsedCurrency.success ? parsedCurrency.data : 'CHF';

      const showCurrencySelector =
        currentUserData.user.user_metadata?.showCurrencySelector === true;

      return {
        success: true as const,
        data: {
          payDayOfMonth,
          currency,
          showCurrencySelector,
        },
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.USER_SETTINGS_FETCH_FAILED,
        undefined,
        { operation: 'getSettings' },
      );
    }
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Update user settings',
    description:
      'Updates the user settings (e.g., payDayOfMonth for custom budget period)',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    type: UserSettingsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async updateSettings(
    @Body() updateData: UpdateUserSettingsDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<UserSettingsResponseDto> {
    try {
      const currentUserData = await this.getCurrentUserData(supabase);
      const serviceClient = this.supabaseService.getServiceRoleClient();

      const { data: updatedUser, error } =
        await serviceClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...currentUserData.user.user_metadata,
            ...(updateData.payDayOfMonth !== undefined && {
              payDayOfMonth: updateData.payDayOfMonth,
            }),
            ...(updateData.currency !== undefined && {
              currency: updateData.currency,
            }),
            ...(updateData.showCurrencySelector !== undefined && {
              showCurrencySelector: updateData.showCurrencySelector,
            }),
          },
        });

      if (error || !updatedUser.user) {
        throw new BusinessException(
          ERROR_DEFINITIONS.USER_SETTINGS_UPDATE_FAILED,
          undefined,
          undefined,
          { cause: error },
        );
      }

      const rawCurrency = updatedUser.user.user_metadata?.currency;
      const parsedCurrency = supportedCurrencySchema.safeParse(rawCurrency);

      return {
        success: true as const,
        data: {
          payDayOfMonth: updatedUser.user.user_metadata?.payDayOfMonth ?? null,
          currency: parsedCurrency.success ? parsedCurrency.data : 'CHF',
          showCurrencySelector:
            updatedUser.user.user_metadata?.showCurrencySelector === true,
        },
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.USER_SETTINGS_UPDATE_FAILED,
        undefined,
        { operation: 'updateSettings', userId: user.id },
      );
    }
  }

  @Delete('account')
  @ApiOperation({
    summary: 'Request account deletion',
    description:
      'Schedules the user account for deletion after a 3-day grace period. User is immediately signed out. ' +
      'Idempotent: returns existing scheduledDeletionAt if already scheduled.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account deletion scheduled successfully',
    type: DeleteAccountResponseDto,
  })
  async deleteAccount(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<DeleteAccountResponseDto> {
    try {
      const currentUserData = await this.getCurrentUserData(supabase);
      const existingDeletion =
        currentUserData.user.user_metadata?.scheduledDeletionAt;

      if (typeof existingDeletion === 'string' && existingDeletion.length > 0) {
        return {
          success: true as const,
          message: 'Ton compte est déjà programmé pour suppression',
          scheduledDeletionAt: existingDeletion,
        };
      }

      // Schedule deletion FIRST - if this fails, user stays logged in (correct state)
      // If we signed out first and this failed, user would be logged out but not scheduled
      const scheduledDeletionAt = await this.scheduleAccountDeletion(
        user.id,
        currentUserData.user.user_metadata,
      );

      // Sign out AFTER scheduling - if this fails, AuthGuard blocks access anyway
      await this.signOutUserGlobally(user.accessToken);

      return {
        success: true as const,
        message: 'Ton compte sera supprimé dans 3 jours',
        scheduledDeletionAt,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.USER_ACCOUNT_DELETION_FAILED,
        undefined,
        { operation: 'deleteAccount', userId: user.id },
      );
    }
  }

  private async scheduleAccountDeletion(
    userId: string,
    currentMetadata: Record<string, unknown> | undefined,
  ): Promise<string> {
    const serviceClient = this.supabaseService.getServiceRoleClient();
    const scheduledDeletionAt = new Date().toISOString();

    const { error } = await serviceClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMetadata,
        scheduledDeletionAt,
      },
    });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_ACCOUNT_DELETION_FAILED,
        undefined,
        undefined,
        { cause: error },
      );
    }

    return scheduledDeletionAt;
  }

  private async signOutUserGlobally(accessToken: string): Promise<void> {
    const serviceClient = this.supabaseService.getServiceRoleClient();

    const { error } = await serviceClient.auth.admin.signOut(
      accessToken,
      'global',
    );

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_ACCOUNT_DELETION_FAILED,
        undefined,
        undefined,
        { cause: error },
      );
    }
  }
}
