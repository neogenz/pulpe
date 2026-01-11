import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
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
  OnboardingStatusResponseDto,
  SuccessMessageResponseDto,
  UpdateUserSettingsDto,
  UserSettingsResponseDto,
} from './dto/user-profile.dto';
import { payDayOfMonthSchema } from 'pulpe-shared';
import { ErrorResponseDto } from '@common/dto/response.dto';

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
    @InjectPinoLogger(UserController.name)
    private readonly logger: PinoLogger,
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
      this.logger.error({ err: error }, 'Failed to update user profile');
      throw new InternalServerErrorException(
        'Erreur lors de la mise à jour du profil',
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
      throw new InternalServerErrorException(
        'Erreur lors de la mise à jour du profil',
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

  @Put('onboarding-completed')
  @ApiOperation({
    summary: 'Mark onboarding as completed',
    description: 'Updates the user metadata to mark onboarding as completed',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding marked as completed',
    type: SuccessMessageResponseDto,
  })
  async completeOnboarding(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<SuccessMessageResponseDto> {
    try {
      await this.updateOnboardingStatus(user.id, supabase);
      return {
        success: true as const,
        message: 'Onboarding marqué comme terminé',
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to update onboarding status');
      throw new InternalServerErrorException(
        "Erreur lors de la mise à jour du statut d'onboarding",
      );
    }
  }

  private async updateOnboardingStatus(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const currentUserData = await this.getCurrentUserData(supabase);
    const serviceClient = this.supabaseService.getServiceRoleClient();

    const { data: updatedUser, error } =
      await serviceClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...currentUserData.user.user_metadata,
          onboardingCompleted: true,
        },
      });

    if (error || !updatedUser.user) {
      this.logger.error(
        { supabaseError: error, hasUser: !!updatedUser?.user },
        'Supabase updateUserById failed for onboarding',
      );
      throw new InternalServerErrorException(
        "Erreur lors de la mise à jour du statut d'onboarding",
      );
    }
  }

  private async getCurrentUserData(supabase: AuthenticatedSupabaseClient) {
    const { data: currentUserData, error: getUserError } =
      await supabase.auth.getUser();

    if (getUserError || !currentUserData.user) {
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des données utilisateur',
      );
    }

    return currentUserData;
  }

  @Get('onboarding-status')
  @ApiOperation({
    summary: 'Get onboarding status',
    description:
      'Retrieves the current onboarding completion status for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
    type: OnboardingStatusResponseDto,
  })
  async getOnboardingStatus(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<OnboardingStatusResponseDto> {
    try {
      const { data: currentUserData, error: getUserError } =
        await supabase.auth.getUser();

      if (getUserError || !currentUserData.user) {
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des données utilisateur',
        );
      }

      const isOnboardingCompleted =
        currentUserData.user.user_metadata?.onboardingCompleted === true;

      return {
        success: true as const,
        onboardingCompleted: isOnboardingCompleted,
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to fetch onboarding status');
      throw new InternalServerErrorException(
        "Erreur lors de la récupération du statut d'onboarding",
      );
    }
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
      const parsed = payDayOfMonthSchema.safeParse(rawPayDay);
      const payDayOfMonth = parsed.success ? parsed.data : null;

      return {
        success: true as const,
        data: {
          payDayOfMonth,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to fetch user settings');
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des paramètres',
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
            payDayOfMonth: updateData.payDayOfMonth ?? null,
          },
        });

      if (error || !updatedUser.user) {
        this.logger.error(
          { supabaseError: error, hasUser: !!updatedUser?.user },
          'Supabase updateUserById failed',
        );
        throw new InternalServerErrorException(
          'Erreur lors de la mise à jour des paramètres',
        );
      }

      return {
        success: true as const,
        data: {
          payDayOfMonth: updatedUser.user.user_metadata?.payDayOfMonth ?? null,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to update user settings');
      throw new InternalServerErrorException(
        'Erreur lors de la mise à jour des paramètres',
      );
    }
  }
}
