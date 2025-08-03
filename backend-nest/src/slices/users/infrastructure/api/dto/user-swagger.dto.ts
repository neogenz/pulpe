import { createZodDto } from '@anatine/zod-nestjs';
import { extendApi } from '@anatine/zod-openapi';
import {
  updateProfileSchema,
  userProfileResponseSchema,
  onboardingStatusResponseSchema,
  successMessageResponseSchema,
} from '@pulpe/shared';

// Create Swagger DTOs
export class UpdateProfileDto extends createZodDto(
  extendApi(updateProfileSchema),
) {}

export class UserProfileResponseDto extends createZodDto(
  extendApi(userProfileResponseSchema),
) {}

export class OnboardingStatusResponseDto extends createZodDto(
  extendApi(onboardingStatusResponseSchema),
) {}

export class SuccessMessageResponseDto extends createZodDto(
  extendApi(successMessageResponseSchema),
) {}
