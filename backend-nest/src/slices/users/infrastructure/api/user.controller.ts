import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type UserProfileResponse,
  type OnboardingStatusResponse,
  type SuccessMessageResponse,
} from '@pulpe/shared';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { LogOperation } from '@shared/infrastructure/logging/logging.decorators';
import { AuthRateLimit } from '@shared/infrastructure/security/throttler.decorators';

// Command and Query handlers
import { UpdateUserProfileHandler } from '../../application/handlers/update-user-profile.handler';
import { CompleteOnboardingHandler } from '../../application/handlers/complete-onboarding.handler';
import { DeleteUserHandler } from '../../application/handlers/delete-user.handler';
import { GetUserHandler } from '../../application/handlers/get-user.handler';
import { GetCurrentUserHandler } from '../../application/handlers/get-current-user.handler';
import { GetOnboardingStatusHandler } from '../../application/handlers/get-onboarding-status.handler';

// Commands and Queries
import { UpdateUserProfileCommand } from '../../application/commands/update-user-profile.command';
import { CompleteOnboardingCommand } from '../../application/commands/complete-onboarding.command';
import { DeleteUserCommand } from '../../application/commands/delete-user.command';
import { GetCurrentUserQuery } from '../../application/queries/get-current-user.query';
import { GetOnboardingStatusQuery } from '../../application/queries/get-onboarding-status.query';

// DTOs
import {
  UpdateProfileDto,
  UserProfileResponseDto,
  OnboardingStatusResponseDto,
  SuccessMessageResponseDto,
} from './dto/user-swagger.dto';

// Mapper and Repository
import { UserMapper } from '../mappers/user.mapper';
import { SupabaseUserRepository } from '../persistence/supabase-user.repository';

@ApiTags('Users v2')
@ApiBearerAuth()
@Controller('v2/users')
@AuthRateLimit()
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
    private readonly updateProfileHandler: UpdateUserProfileHandler,
    private readonly completeOnboardingHandler: CompleteOnboardingHandler,
    private readonly deleteHandler: DeleteUserHandler,
    private readonly getHandler: GetUserHandler,
    private readonly getCurrentHandler: GetCurrentUserHandler,
    private readonly getOnboardingStatusHandler: GetOnboardingStatusHandler,
    private readonly repository: SupabaseUserRepository,
    private readonly mapper: UserMapper,
  ) {}

  @Get('me')
  @LogOperation('GetCurrentUser')
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
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<UserProfileResponse> {
    this.repository.setSupabaseClient(supabase);

    const query = new GetCurrentUserQuery(user.id);
    const result = await this.getCurrentHandler.execute(query);
    if (result.isFail()) {
      throw result.error;
    }

    const userSnapshot = result.value;
    return {
      success: true,
      user: {
        id: userSnapshot.id,
        email: userSnapshot.email,
        ...(userSnapshot.firstName && { firstName: userSnapshot.firstName }),
        ...(userSnapshot.lastName && { lastName: userSnapshot.lastName }),
      },
    };
  }

  @Put('profile')
  @LogOperation('UpdateUserProfile')
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
    @Body(ValidationPipe) updateDto: UpdateProfileDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<UserProfileResponse> {
    this.repository.setSupabaseClient(supabase);

    const command = new UpdateUserProfileCommand(
      user.id,
      updateDto.firstName,
      updateDto.lastName,
    );

    const result = await this.updateProfileHandler.execute(command);
    if (result.isFail()) {
      throw result.error;
    }

    return {
      success: true,
      user: {
        id: result.value.id,
        email: result.value.email,
        ...(result.value.firstName && { firstName: result.value.firstName }),
        ...(result.value.lastName && { lastName: result.value.lastName }),
      },
    };
  }

  @Put('onboarding-completed')
  @LogOperation('CompleteOnboarding')
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
  ): Promise<SuccessMessageResponse> {
    this.repository.setSupabaseClient(supabase);

    const command = new CompleteOnboardingCommand(user.id);
    const result = await this.completeOnboardingHandler.execute(command);
    if (result.isFail()) {
      throw result.error;
    }

    return {
      success: true,
      message: result.value.message,
    };
  }

  @Get('onboarding-status')
  @LogOperation('GetOnboardingStatus')
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
  ): Promise<OnboardingStatusResponse> {
    this.repository.setSupabaseClient(supabase);

    const query = new GetOnboardingStatusQuery(user.id);
    const result = await this.getOnboardingStatusHandler.execute(query);
    if (result.isFail()) {
      throw result.error;
    }

    return {
      success: true,
      onboardingCompleted: result.value.onboardingCompleted,
    };
  }

  @Delete('me')
  @LogOperation('DeleteUser')
  @ApiOperation({
    summary: 'Delete user account',
    description: 'Permanently deletes the authenticated user account',
  })
  @ApiResponse({
    status: 200,
    description: 'Account deleted successfully',
    type: SuccessMessageResponseDto,
  })
  async deleteAccount(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<SuccessMessageResponse> {
    this.repository.setSupabaseClient(supabase);

    const command = new DeleteUserCommand(user.id);
    const result = await this.deleteHandler.execute(command);
    if (result.isFail()) {
      throw result.error;
    }

    return {
      success: true,
      message: result.value.message,
    };
  }
}
