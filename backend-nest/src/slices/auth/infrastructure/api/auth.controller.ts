import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Headers,
  Ip,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { User } from '@/common/decorators/user.decorator';
import { Public } from '@/shared/infrastructure/security/auth.decorators';
import { PinoLogger } from 'nestjs-pino';
import {
  SignUpDto,
  SignInDto,
  RefreshTokenDto,
  AuthResponseDto,
  SessionResponseDto,
} from './dto/auth-swagger.dto';
import { SignUpCommand } from '../../application/commands/sign-up.command';
import { SignInCommand } from '../../application/commands/sign-in.command';
import { SignOutCommand } from '../../application/commands/sign-out.command';
import { RefreshTokenCommand } from '../../application/commands/refresh-token.command';
import { GetSessionQuery } from '../../application/queries/get-session.query';
import { ValidateTokenQuery } from '../../application/queries/validate-token.query';
import { AuthMapper } from '../mappers/auth.mapper';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@ApiTags('auth')
@Controller('api/v2/auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly authMapper: AuthMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthController.name);
  }

  @Post('sign-up')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Sign up a new user',
    description: 'Register a new user account with email and password',
  })
  @ApiBody({ type: SignUpDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully signed up',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
    type: ErrorResponseDto,
  })
  async signUp(
    @Body() dto: SignUpDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'auth.sign-up.start',
      email: dto.email,
    });

    const command = new SignUpCommand(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
      ipAddress,
      userAgent,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'auth.sign-up.failed',
        email: dto.email,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const authSession = result.getValue();
    const response = this.authMapper.toAuthResponse(authSession);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'auth.sign-up.success',
      userId: authSession.userId,
      email: authSession.email,
      duration,
    });

    return response;
  }

  @Post('sign-in')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in an existing user',
    description: 'Authenticate a user with email and password',
  })
  @ApiBody({ type: SignInDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully signed in',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
    type: ErrorResponseDto,
  })
  async signIn(
    @Body() dto: SignInDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'auth.sign-in.start',
      email: dto.email,
    });

    const command = new SignInCommand(
      dto.email,
      dto.password,
      ipAddress,
      userAgent,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'auth.sign-in.failed',
        email: dto.email,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const authSession = result.getValue();
    const response = this.authMapper.toAuthResponse(authSession);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'auth.sign-in.success',
      userId: authSession.userId,
      email: authSession.email,
      duration,
    });

    return response;
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign out the current user',
    description: 'Invalidate the current user session',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User successfully signed out',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  async signOut(@User('id') userId: string): Promise<void> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'auth.sign-out.start',
      userId,
    });

    const command = new SignOutCommand(userId);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'auth.sign-out.failed',
        userId,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'auth.sign-out.success',
      userId,
      duration,
    });
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh authentication token',
    description: 'Exchange a refresh token for a new access token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token successfully refreshed',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
    type: ErrorResponseDto,
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<SessionResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'auth.refresh-token.start',
    });

    const command = new RefreshTokenCommand(dto.refreshToken);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'auth.refresh-token.failed',
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const session = result.getValue();
    const response = this.authMapper.toSessionResponse(session);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'auth.refresh-token.success',
      userId: session.userId,
      duration,
    });

    return response;
  }

  @Get('session')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current session',
    description:
      'Retrieve information about the current authentication session',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session information retrieved',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  async getSession(
    @Headers('authorization') authHeader: string,
  ): Promise<AuthResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'auth.get-session.start',
    });

    // Extract token from Bearer header
    const token = authHeader?.replace('Bearer ', '') || '';

    const query = new GetSessionQuery(token);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'auth.get-session.failed',
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const authSession = result.getValue();
    if (!authSession) {
      throw new GenericDomainException(
        'Session not found',
        'SESSION_NOT_FOUND',
        'No active session found for this token',
      );
    }

    const response = this.authMapper.toAuthResponse(authSession);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'auth.get-session.success',
      userId: authSession.userId,
      duration,
    });

    return response;
  }

  @Get('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate authentication token',
    description: 'Check if an authentication token is valid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
      },
    },
  })
  async validateToken(
    @Headers('authorization') authHeader: string,
  ): Promise<{ valid: boolean }> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'auth.validate-token.start',
    });

    // Extract token from Bearer header
    const token = authHeader?.replace('Bearer ', '') || '';

    const query = new ValidateTokenQuery(token);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'auth.validate-token.failed',
        error: result.error.message,
        duration,
      });
      return { valid: false };
    }

    const isValid = result.getValue();

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'auth.validate-token.success',
      valid: isValid,
      duration,
    });

    return { valid: isValid };
  }
}
