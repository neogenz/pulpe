import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  InternalServerErrorException,
  ValidationPipe,
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
import { SkipThrottle } from '@nestjs/throttler';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  UpdateProfileDto,
  UserProfileResponseDto,
  OnboardingStatusResponseDto,
  SuccessMessageResponseDto,
} from './dto/user-profile.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('User')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(AuthGuard)
@SkipThrottle()
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
    @Body(ValidationPipe) updateData: UpdateProfileDto,
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
      await this.updateOnboardingStatus(supabase);
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
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const currentUserData = await this.getCurrentUserData(supabase);

    const { data: updatedUser, error } = await supabase.auth.updateUser({
      data: {
        ...currentUserData.user.user_metadata,
        onboardingCompleted: true,
      },
    });

    if (error || !updatedUser.user) {
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
}
