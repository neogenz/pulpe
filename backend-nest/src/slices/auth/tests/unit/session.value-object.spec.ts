import { describe, it, expect } from 'bun:test';
import { Session } from '../../domain/value-objects/session.value-object';

describe('Session Value Object', () => {
  const validProps = {
    accessToken: 'valid-access-token',
    refreshToken: 'valid-refresh-token',
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    userId: '123e4567-e89b-12d3-a456-426614174000',
  };

  describe('create', () => {
    it('should create a valid session', () => {
      const result = Session.create(validProps);

      expect(result.isSuccess).toBe(true);
      const session = result.getValue();
      expect(session.accessToken).toBe(validProps.accessToken);
      expect(session.refreshToken).toBe(validProps.refreshToken);
      expect(session.expiresAt).toEqual(validProps.expiresAt);
      expect(session.userId).toBe(validProps.userId);
    });

    it('should fail when access token is empty', () => {
      const props = { ...validProps, accessToken: '' };
      const result = Session.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_SESSION');
      expect(result.error.message).toBe('Access token is required');
    });

    it('should fail when user ID is empty', () => {
      const props = { ...validProps, userId: '' };
      const result = Session.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_SESSION');
      expect(result.error.message).toBe('User ID is required');
    });

    it('should fail when expiration date is invalid', () => {
      const props = { ...validProps, expiresAt: null as any };
      const result = Session.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_SESSION');
      expect(result.error.message).toBe('Valid expiration date is required');
    });

    it('should fail when session is already expired', () => {
      const props = { ...validProps, expiresAt: new Date(Date.now() - 1000) };
      const result = Session.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('EXPIRED_SESSION');
      expect(result.error.message).toBe('Session already expired');
    });

    it('should create session without refresh token', () => {
      const props = { ...validProps, refreshToken: undefined };
      const result = Session.create(props);

      expect(result.isSuccess).toBe(true);
      const session = result.getValue();
      expect(session.refreshToken).toBeUndefined();
    });
  });

  describe('isExpired', () => {
    it('should return false for non-expired session', () => {
      const result = Session.create(validProps);
      const session = result.getValue();

      expect(session.isExpired()).toBe(false);
    });

    it('should return true for expired session', () => {
      const props = {
        ...validProps,
        expiresAt: new Date(Date.now() + 100), // Expires in 100ms
      };
      const result = Session.create(props);
      const session = result.getValue();

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(session.isExpired()).toBe(true);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('isAboutToExpire', () => {
    it('should return false when session has plenty of time left', () => {
      const props = {
        ...validProps,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      };
      const result = Session.create(props);
      const session = result.getValue();

      expect(session.isAboutToExpire()).toBe(false);
      expect(session.isAboutToExpire(30)).toBe(false);
    });

    it('should return true when session is about to expire', () => {
      const props = {
        ...validProps,
        expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes
      };
      const result = Session.create(props);
      const session = result.getValue();

      expect(session.isAboutToExpire(5)).toBe(true); // Within 5 minutes
      expect(session.isAboutToExpire(3)).toBe(false); // Not within 3 minutes
    });

    it('should use default threshold of 5 minutes', () => {
      const props = {
        ...validProps,
        expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes
      };
      const result = Session.create(props);
      const session = result.getValue();

      expect(session.isAboutToExpire()).toBe(true);
    });
  });

  describe('getRemainingTime', () => {
    it('should return positive time for non-expired session', () => {
      const result = Session.create(validProps);
      const session = result.getValue();

      const remainingTime = session.getRemainingTime();
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(3600 * 1000);
    });

    it('should return 0 for expired session', () => {
      const props = {
        ...validProps,
        expiresAt: new Date(Date.now() + 100), // Expires in 100ms
      };
      const result = Session.create(props);
      const session = result.getValue();

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(session.getRemainingTime()).toBe(0);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize session to JSON', () => {
      const result = Session.create(validProps);
      const session = result.getValue();
      const json = session.toJSON();

      expect(json).toEqual({
        accessToken: validProps.accessToken,
        refreshToken: validProps.refreshToken,
        expiresAt: validProps.expiresAt.toISOString(),
        userId: validProps.userId,
      });
    });

    it('should serialize session without refresh token', () => {
      const props = { ...validProps, refreshToken: undefined };
      const result = Session.create(props);
      const session = result.getValue();
      const json = session.toJSON();

      expect(json).toEqual({
        accessToken: props.accessToken,
        refreshToken: undefined,
        expiresAt: props.expiresAt.toISOString(),
        userId: props.userId,
      });
    });
  });
});
