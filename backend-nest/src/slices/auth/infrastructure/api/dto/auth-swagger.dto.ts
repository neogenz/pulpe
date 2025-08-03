import { createZodDto } from '@anatine/zod-nestjs';
import { ApiProperty } from '@nestjs/swagger';
import {
  SignUpSchema,
  SignInSchema,
  RefreshTokenSchema,
  AuthResponseSchema,
  SessionResponseSchema,
} from '@pulpe/shared';

// Request DTOs
export class SignUpDto extends createZodDto(SignUpSchema) {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({ description: 'User password', example: 'StrongP@ssw0rd' })
  password!: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    required: false,
  })
  firstName?: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: false,
  })
  lastName?: string;
}

export class SignInDto extends createZodDto(SignInSchema) {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({ description: 'User password', example: 'StrongP@ssw0rd' })
  password!: string;
}

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;
}

// Response DTOs
export class AuthResponseDto extends createZodDto(AuthResponseSchema) {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email!: string;

  @ApiProperty({
    description: 'Access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false,
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Token expiration date',
    example: '2024-12-31T23:59:59.999Z',
  })
  expiresAt!: string;
}

export class SessionResponseDto extends createZodDto(SessionResponseSchema) {
  @ApiProperty({
    description: 'Access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false,
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Token expiration date',
    example: '2024-12-31T23:59:59.999Z',
  })
  expiresAt!: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;
}
