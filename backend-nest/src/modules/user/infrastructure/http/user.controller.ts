import { Controller, Get, Put, Delete, Body, UseGuards } from '@nestjs/common';
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
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import {
  UpdateProfileDto,
  UserProfileResponseDto,
  UpdateUserSettingsDto,
  UserSettingsResponseDto,
  DeleteAccountResponseDto,
} from './dto/user-profile.dto';
import { GetUserProfileUseCase } from '../../application/get-user-profile.use-case';
import { UpdateUserProfileUseCase } from '../../application/update-user-profile.use-case';
import { GetUserSettingsUseCase } from '../../application/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../../application/update-user-settings.use-case';
import { ScheduleAccountDeletionUseCase } from '../../application/schedule-account-deletion.use-case';

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
    private readonly getProfileUseCase: GetUserProfileUseCase,
    private readonly updateProfileUseCase: UpdateUserProfileUseCase,
    private readonly getSettingsUseCase: GetUserSettingsUseCase,
    private readonly updateSettingsUseCase: UpdateUserSettingsUseCase,
    private readonly scheduleAccountDeletionUseCase: ScheduleAccountDeletionUseCase,
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
  getProfile(@User() user: AuthenticatedUser): UserProfileResponseDto {
    return {
      success: true as const,
      user: this.getProfileUseCase.execute(user),
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
  ): Promise<UserProfileResponseDto> {
    const profile = await this.updateProfileUseCase.execute(updateData, user);
    return { success: true as const, user: profile };
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
  async getSettings(): Promise<UserSettingsResponseDto> {
    const settings = await this.getSettingsUseCase.execute();
    return { success: true as const, data: settings };
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
  ): Promise<UserSettingsResponseDto> {
    const settings = await this.updateSettingsUseCase.execute(updateData, user);
    return { success: true as const, data: settings };
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
  ): Promise<DeleteAccountResponseDto> {
    const result = await this.scheduleAccountDeletionUseCase.execute(user);
    return {
      success: true as const,
      message: result.alreadyScheduled
        ? 'Ton compte est déjà programmé pour suppression'
        : 'Ton compte sera supprimé dans 3 jours',
      scheduledDeletionAt: result.scheduledDeletionAt,
    };
  }
}
