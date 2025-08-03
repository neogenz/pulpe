import { describe, it, expect } from 'bun:test';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { Session } from '../../domain/value-objects/session.value-object';

describe('AuthSession Entity', () => {
  const createValidSession = () => {
    return Session.create({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      userId: '123e4567-e89b-12d3-a456-426614174000',
    }).getValue();
  };

  const validProps = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    session: createValidSession(),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  describe('create', () => {
    it('should create a valid auth session', () => {
      const result = AuthSession.create(validProps);

      expect(result.isSuccess).toBe(true);
      const authSession = result.getValue();
      expect(authSession.userId).toBe(validProps.userId);
      expect(authSession.email).toBe(validProps.email);
      expect(authSession.session).toBe(validProps.session);
      expect(authSession.ipAddress).toBe(validProps.ipAddress);
      expect(authSession.userAgent).toBe(validProps.userAgent);
    });

    it('should create auth session without device info', () => {
      const props = {
        userId: validProps.userId,
        email: validProps.email,
        session: validProps.session,
      };
      const result = AuthSession.create(props);

      expect(result.isSuccess).toBe(true);
      const authSession = result.getValue();
      expect(authSession.ipAddress).toBeUndefined();
      expect(authSession.userAgent).toBeUndefined();
    });

    it('should fail when user ID is empty', () => {
      const props = { ...validProps, userId: '' };
      const result = AuthSession.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AUTH_SESSION');
      expect(result.error.message).toBe('User ID is required');
    });

    it('should fail when email is empty', () => {
      const props = { ...validProps, email: '' };
      const result = AuthSession.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AUTH_SESSION');
      expect(result.error.message).toBe('Email is required');
    });

    it('should create with existing ID', () => {
      const existingId = 'existing-id';
      const result = AuthSession.create(validProps, existingId);

      expect(result.isSuccess).toBe(true);
      const authSession = result.getValue();
      expect(authSession.id).toBe(existingId);
    });
  });

  describe('isValid', () => {
    it('should return true for non-expired session', () => {
      const result = AuthSession.create(validProps);
      const authSession = result.getValue();

      expect(authSession.isValid()).toBe(true);
    });

    it('should return false for expired session', () => {
      const expiredSession = Session.create({
        accessToken: 'valid-access-token',
        expiresAt: new Date(Date.now() + 100), // Expires in 100ms
        userId: validProps.userId,
      }).getValue();

      const props = { ...validProps, session: expiredSession };
      const result = AuthSession.create(props);
      const authSession = result.getValue();

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(authSession.isValid()).toBe(false);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('needsRefresh', () => {
    it('should return false when session has plenty of time', () => {
      const result = AuthSession.create(validProps);
      const authSession = result.getValue();

      expect(authSession.needsRefresh()).toBe(false);
    });

    it('should return true when session is about to expire', () => {
      const aboutToExpireSession = Session.create({
        accessToken: 'valid-access-token',
        expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes
        userId: validProps.userId,
      }).getValue();

      const props = { ...validProps, session: aboutToExpireSession };
      const result = AuthSession.create(props);
      const authSession = result.getValue();

      expect(authSession.needsRefresh()).toBe(true);
    });
  });

  describe('refresh', () => {
    it('should refresh session successfully', () => {
      const result = AuthSession.create(validProps);
      const authSession = result.getValue();

      const newSession = Session.create({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 7200 * 1000), // 2 hours
        userId: validProps.userId,
      }).getValue();

      const refreshResult = authSession.refresh(newSession);

      expect(refreshResult.isSuccess).toBe(true);
      expect(authSession.session).toBe(newSession);
      expect(authSession.updatedAt).not.toBe(authSession.createdAt);
    });

    it('should fail to refresh with different user ID', () => {
      const result = AuthSession.create(validProps);
      const authSession = result.getValue();

      const differentUserSession = Session.create({
        accessToken: 'new-access-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        userId: 'different-user-id',
      }).getValue();

      const refreshResult = authSession.refresh(differentUserSession);

      expect(refreshResult.isFailure).toBe(true);
      expect(refreshResult.error.code).toBe('INVALID_REFRESH');
      expect(refreshResult.error.message).toBe('User mismatch');
    });
  });

  describe('updateDeviceInfo', () => {
    it('should update device info successfully', () => {
      const props = {
        userId: validProps.userId,
        email: validProps.email,
        session: validProps.session,
      };
      const result = AuthSession.create(props);
      const authSession = result.getValue();

      const updateResult = authSession.updateDeviceInfo(
        '10.0.0.1',
        'Chrome/96.0',
      );

      expect(updateResult.isSuccess).toBe(true);
      expect(authSession.ipAddress).toBe('10.0.0.1');
      expect(authSession.userAgent).toBe('Chrome/96.0');
      expect(authSession.updatedAt).not.toBe(authSession.createdAt);
    });

    it('should clear device info when undefined is passed', () => {
      const result = AuthSession.create(validProps);
      const authSession = result.getValue();

      const updateResult = authSession.updateDeviceInfo(undefined, undefined);

      expect(updateResult.isSuccess).toBe(true);
      expect(authSession.ipAddress).toBeUndefined();
      expect(authSession.userAgent).toBeUndefined();
    });
  });

  describe('canPerformSensitiveOperation', () => {
    it('should return true for valid session with time left', () => {
      const result = AuthSession.create(validProps);
      const authSession = result.getValue();

      expect(authSession.canPerformSensitiveOperation()).toBe(true);
    });

    it('should return false for session about to expire soon', () => {
      const aboutToExpireSession = Session.create({
        accessToken: 'valid-access-token',
        expiresAt: new Date(Date.now() + 8 * 60 * 1000), // 8 minutes
        userId: validProps.userId,
      }).getValue();

      const props = { ...validProps, session: aboutToExpireSession };
      const result = AuthSession.create(props);
      const authSession = result.getValue();

      expect(authSession.canPerformSensitiveOperation()).toBe(false);
    });

    it('should return false for expired session', () => {
      const expiredSession = Session.create({
        accessToken: 'valid-access-token',
        expiresAt: new Date(Date.now() + 100), // Expires in 100ms
        userId: validProps.userId,
      }).getValue();

      const props = { ...validProps, session: expiredSession };
      const result = AuthSession.create(props);
      const authSession = result.getValue();

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(authSession.canPerformSensitiveOperation()).toBe(false);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('toSnapshot', () => {
    it('should create a complete snapshot', () => {
      const result = AuthSession.create(validProps);
      const authSession = result.getValue();
      const snapshot = authSession.toSnapshot();

      expect(snapshot).toEqual({
        id: authSession.id,
        userId: validProps.userId,
        email: validProps.email,
        accessToken: validProps.session.accessToken,
        refreshToken: validProps.session.refreshToken,
        expiresAt: validProps.session.expiresAt,
        ipAddress: validProps.ipAddress,
        userAgent: validProps.userAgent,
        createdAt: authSession.createdAt,
        updatedAt: authSession.updatedAt,
      });
    });

    it('should create snapshot without optional fields', () => {
      const sessionWithoutRefresh = Session.create({
        accessToken: 'valid-access-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        userId: validProps.userId,
      }).getValue();

      const props = {
        userId: validProps.userId,
        email: validProps.email,
        session: sessionWithoutRefresh,
      };
      const result = AuthSession.create(props);
      const authSession = result.getValue();
      const snapshot = authSession.toSnapshot();

      expect(snapshot.refreshToken).toBeUndefined();
      expect(snapshot.ipAddress).toBeUndefined();
      expect(snapshot.userAgent).toBeUndefined();
    });
  });
});
