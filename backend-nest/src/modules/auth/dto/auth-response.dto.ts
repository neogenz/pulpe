import { ApiProperty } from '@nestjs/swagger';

export class UserInfoDto {
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
}

export class AuthValidationResponseDto {
  @ApiProperty({
    description: 'Indicates if the token validation was successful',
    example: true,
  })
  success!: true;

  @ApiProperty({
    description: 'Authenticated user information',
    type: UserInfoDto,
  })
  user!: UserInfoDto;
}

export class AuthErrorResponseDto {
  @ApiProperty({
    description: 'Indicates the request failed',
    example: false,
  })
  success!: false;

  @ApiProperty({
    description: 'Error message',
    example: 'Token invalide',
  })
  error!: string;
}
