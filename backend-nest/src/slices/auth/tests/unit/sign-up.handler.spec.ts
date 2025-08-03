import { Test } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { describe, it, expect, beforeEach, mock, Mock } from 'bun:test';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { SignUpHandler } from '../../application/handlers/sign-up.handler';
import { SignUpCommand } from '../../application/commands/sign-up.command';
import {
  AUTH_REPOSITORY_TOKEN,
  type AuthRepository,
} from '../../domain/repositories/auth.repository';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { Session } from '../../domain/value-objects/session.value-object';
import { UserSignedUpEvent } from '../../domain/events/user-signed-up.event';

describe('SignUpHandler', () => {
  let handler: SignUpHandler;
  let authRepository: AuthRepository;
  let eventBus: EventBus;
  let logger: PinoLogger;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEmail = 'test@example.com';
  const mockPassword = 'StrongP@ssw0rd';
  const mockFirstName = 'John';
  const mockLastName = 'Doe';
  const mockIpAddress = '192.168.1.1';
  const mockUserAgent = 'Mozilla/5.0';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SignUpHandler,
        {
          provide: AUTH_REPOSITORY_TOKEN,
          useValue: {
            signUp: mock(),
          },
        },
        {
          provide: EventBus,
          useValue: {
            publish: mock(),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: mock(),
            info: mock(),
            warn: mock(),
            error: mock(),
          },
        },
      ],
    }).compile();

    handler = module.get<SignUpHandler>(SignUpHandler);
    authRepository = module.get<AuthRepository>(AUTH_REPOSITORY_TOKEN);
    eventBus = module.get<EventBus>(EventBus);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  it('should successfully sign up a new user', async () => {
    // Arrange
    const sessionResult = Session.create({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      userId: mockUserId,
    });

    expect(sessionResult.isSuccess).toBe(true);

    const authSessionResult = AuthSession.create({
      userId: mockUserId,
      email: mockEmail,
      session: sessionResult.value,
    });

    expect(authSessionResult.isSuccess).toBe(true);
    const mockAuthSession = authSessionResult.value;
    (authRepository.signUp as Mock).mockResolvedValue(
      Result.ok(mockAuthSession),
    );

    const command = new SignUpCommand(
      mockEmail,
      mockPassword,
      mockFirstName,
      mockLastName,
      mockIpAddress,
      mockUserAgent,
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual(mockAuthSession);

    expect(authRepository.signUp).toHaveBeenCalledWith({
      email: mockEmail,
      password: mockPassword,
      firstName: mockFirstName,
      lastName: mockLastName,
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(UserSignedUpEvent),
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'sign-up.start',
        email: mockEmail,
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'sign-up.success',
        userId: mockUserId,
        email: mockEmail,
      }),
    );
  });

  it('should handle sign up failure when user already exists', async () => {
    // Arrange
    const error = 'User already exists';
    (authRepository.signUp as Mock).mockResolvedValue(Result.fail(error));

    const command = new SignUpCommand(
      mockEmail,
      mockPassword,
      mockFirstName,
      mockLastName,
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toBe(error);

    expect(eventBus.publish).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'sign-up.failed',
        email: mockEmail,
        error,
      }),
    );
  });

  it('should handle unexpected errors during sign up', async () => {
    // Arrange
    const unexpectedError = new Error('Database connection failed');
    (authRepository.signUp as Mock).mockRejectedValue(unexpectedError);

    const command = new SignUpCommand(mockEmail, mockPassword);

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toContain('Failed to sign up user');

    expect(eventBus.publish).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'sign-up.error',
        email: mockEmail,
        error: unexpectedError.message,
      }),
    );
  });

  it('should update device info when provided', async () => {
    // Arrange
    const sessionResult = Session.create({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      userId: mockUserId,
    });

    const authSessionResult = AuthSession.create({
      userId: mockUserId,
      email: mockEmail,
      session: sessionResult.value,
      ipAddress: mockIpAddress,
      userAgent: mockUserAgent,
    });

    const mockAuthSession = authSessionResult.value;

    (authRepository.signUp as Mock).mockResolvedValue(
      Result.ok(mockAuthSession),
    );

    const command = new SignUpCommand(
      mockEmail,
      mockPassword,
      undefined,
      undefined,
      mockIpAddress,
      mockUserAgent,
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(result.value.ipAddress).toBe(mockIpAddress);
    expect(result.value.userAgent).toBe(mockUserAgent);
  });
});
