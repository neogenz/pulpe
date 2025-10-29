import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import {
  AuthValidationResponseDto,
  AuthErrorResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller({ path: 'auth', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: AuthErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: AuthErrorResponseDto,
})
export class AuthController {
  @Get('validate')
  @ApiOperation({
    summary: 'Validate JWT token and retrieve user information',
    description:
      'Validates the provided Bearer token and returns authenticated user details',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validated successfully',
    type: AuthValidationResponseDto,
  })
  async validateToken(
    @User() user: AuthenticatedUser,
  ): Promise<AuthValidationResponseDto> {
    return {
      success: true as const,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }
}
