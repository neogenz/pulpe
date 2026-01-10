import { createZodDto } from 'nestjs-zod';
import {
  updateProfileSchema,
  userProfileResponseSchema,
  publicInfoResponseSchema,
  onboardingStatusResponseSchema,
  successMessageResponseSchema,
  updateUserSettingsSchema,
  userSettingsResponseSchema,
} from 'pulpe-shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
export class UserProfileResponseDto extends createZodDto(
  userProfileResponseSchema,
) {}
export class PublicInfoResponseDto extends createZodDto(
  publicInfoResponseSchema,
) {}
export class OnboardingStatusResponseDto extends createZodDto(
  onboardingStatusResponseSchema,
) {}
export class SuccessMessageResponseDto extends createZodDto(
  successMessageResponseSchema,
) {}

// DTOs pour les paramètres utilisateur
export class UpdateUserSettingsDto extends createZodDto(
  updateUserSettingsSchema,
) {}
export class UserSettingsResponseDto extends createZodDto(
  userSettingsResponseSchema,
) {}
