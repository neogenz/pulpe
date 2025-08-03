import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AuthController } from '../../infrastructure/api/auth.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { AuthMapper } from '../../infrastructure/mappers/auth.mapper';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { Session } from '../../domain/value-objects/session.value-object';

describe('AuthController', () => {
  let controller: AuthController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let logger: PinoLogger;
  let authMapper: AuthMapper;

  const mockAuthSession = AuthSession.create({
    userId: 'test-user-id',
    email: 'test@example.com',
    session: Session.create({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      userId: 'test-user-id',
    }).getValue()!,
  }).getValue()!;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: CommandBus,
          useValue: {
            execute: mock(() => Result.ok(mockAuthSession)),
          },
        },
        {
          provide: QueryBus,
          useValue: {
            execute: mock(() => Result.ok(mockAuthSession)),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: mock(() => {}),
            info: mock(() => {}),
            warn: mock(() => {}),
            error: mock(() => {}),
          },
        },
        {
          provide: AuthMapper,
          useValue: {
            toAuthResponse: mock(() => ({
              userId: mockAuthSession.userId,
              email: mockAuthSession.email,
              accessToken: mockAuthSession.session.accessToken,
              refreshToken: mockAuthSession.session.refreshToken,
              expiresAt: mockAuthSession.session.expiresAt,
            })),
            toSessionResponse: mock(() => ({
              userId: mockAuthSession.userId,
              accessToken: mockAuthSession.session.accessToken,
              expiresAt: mockAuthSession.session.expiresAt,
            })),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
    logger = module.get<PinoLogger>(PinoLogger);
    authMapper = module.get<AuthMapper>(AuthMapper);
  });

  describe('signUp', () => {
    it('should successfully sign up a new user', async () => {
      const signUpData = {
        email: 'test@example.com',
        password: 'StrongP@ssw0rd123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await controller.signUp(
        signUpData,
        '127.0.0.1',
        'Test User Agent',
      );

      expect(commandBus.execute).toHaveBeenCalled();
      expect(authMapper.toAuthResponse).toHaveBeenCalledWith(mockAuthSession);
      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expect.any(String),
      });
    });

    it('should throw when sign up fails', async () => {
      const signUpData = {
        email: 'existing@example.com',
        password: 'StrongP@ssw0rd123',
      };

      const error = new GenericDomainException(
        'User already exists',
        'USER_ALREADY_EXISTS',
      );
      commandBus.execute = mock(() => Result.fail(error));

      try {
        await controller.signUp(signUpData, '127.0.0.1');
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBe(error);
      }
    });
  });

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      const signInData = {
        email: 'test@example.com',
        password: 'StrongP@ssw0rd123',
      };

      const result = await controller.signIn(
        signInData,
        '127.0.0.1',
        'Test User Agent',
      );

      expect(commandBus.execute).toHaveBeenCalled();
      expect(authMapper.toAuthResponse).toHaveBeenCalledWith(mockAuthSession);
      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expect.any(String),
      });
    });

    it('should throw when credentials are invalid', async () => {
      const signInData = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const error = new GenericDomainException(
        'Invalid credentials',
        'INVALID_CREDENTIALS',
      );
      commandBus.execute = mock(() => Result.fail(error));

      try {
        await controller.signIn(signInData, '127.0.0.1');
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBe(error);
      }
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const refreshData = {
        refreshToken: 'valid-refresh-token',
      };

      const result = await controller.refreshToken(refreshData);

      expect(commandBus.execute).toHaveBeenCalled();
      expect(authMapper.toSessionResponse).toHaveBeenCalledWith(
        mockAuthSession.session,
      );
      expect(result).toEqual({
        userId: 'test-user-id',
        accessToken: 'test-access-token',
        expiresAt: expect.any(String),
      });
    });

    it('should throw when refresh token is invalid', async () => {
      const refreshData = {
        refreshToken: 'invalid-refresh-token',
      };

      const error = new GenericDomainException(
        'Token refresh failed',
        'TOKEN_REFRESH_FAILED',
      );
      commandBus.execute = mock(() => Result.fail(error));

      try {
        await controller.refreshToken(refreshData);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBe(error);
      }
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      const authHeader = 'Bearer valid-token';

      queryBus.execute = mock(() => Result.ok(true));

      const result = await controller.validateToken(authHeader);

      expect(queryBus.execute).toHaveBeenCalled();
      expect(result).toEqual({ valid: true });
    });

    it('should return false for invalid token', async () => {
      const authHeader = 'Bearer invalid-token';

      queryBus.execute = mock(() => Result.ok(false));

      const result = await controller.validateToken(authHeader);

      expect(queryBus.execute).toHaveBeenCalled();
      expect(result).toEqual({ valid: false });
    });
  });

  describe('signOut', () => {
    it('should successfully sign out user', async () => {
      const userId = 'test-user-id';

      await controller.signOut(userId);

      expect(commandBus.execute).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw when sign out fails', async () => {
      const userId = 'test-user-id';
      const error = new GenericDomainException(
        'Sign out failed',
        'SIGN_OUT_FAILED',
      );
      commandBus.execute = mock(() => Result.fail(error));

      try {
        await controller.signOut(userId);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBe(error);
      }
    });
  });

  describe('getSession', () => {
    it('should return current session', async () => {
      const authHeader = 'Bearer valid-token';

      const result = await controller.getSession(authHeader);

      expect(queryBus.execute).toHaveBeenCalled();
      expect(authMapper.toAuthResponse).toHaveBeenCalledWith(mockAuthSession);
      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expect.any(String),
      });
    });

    it('should throw when session not found', async () => {
      const authHeader = 'Bearer invalid-token';

      queryBus.execute = mock(() => Result.ok(null));

      try {
        await controller.getSession(authHeader);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(GenericDomainException);
        expect(err.code).toBe('SESSION_NOT_FOUND');
      }
    });
  });
});
