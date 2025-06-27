import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UserProfileDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John',
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
  })
  lastName?: string;
}

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName!: string;
}

export class UserProfileResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success!: true;

  @ApiProperty({
    description: 'User profile information',
    type: UserProfileDto,
  })
  user!: UserProfileDto;
}

export class PublicInfoResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success!: true;

  @ApiProperty({
    description: 'Welcome message',
    example: 'Bonjour John !',
  })
  message!: string;

  @ApiProperty({
    description: 'Whether the user is authenticated',
    example: true,
  })
  authenticated!: boolean;
}

export class OnboardingStatusResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success!: true;

  @ApiProperty({
    description: 'Whether onboarding has been completed',
    example: false,
  })
  onboardingCompleted!: boolean;
}

export class SuccessMessageResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success!: true;

  @ApiProperty({
    description: 'Success message',
    example: 'Onboarding marqué comme terminé',
  })
  message!: string;
}
