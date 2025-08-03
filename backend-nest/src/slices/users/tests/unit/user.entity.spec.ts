import { describe, it, expect, beforeEach } from 'bun:test';
import { User } from '../../domain/entities/user.entity';

describe('User Entity', () => {
  describe('create', () => {
    it('should create a valid user', () => {
      // Arrange
      const props = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        onboardingCompleted: false,
      };

      // Act
      const result = User.create(props);

      // Assert
      expect(result.isOk()).toBe(true);
      const user = result.value!;
      expect(user.email).toBe(props.email);
      expect(user.firstName).toBe(props.firstName);
      expect(user.lastName).toBe(props.lastName);
      expect(user.fullName).toBe('John Doe');
      expect(user.onboardingCompleted).toBe(false);
    });

    it('should fail with empty email', () => {
      // Arrange
      const props = {
        email: '',
        onboardingCompleted: false,
      };

      // Act
      const result = User.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_USER');
    });

    it('should fail with invalid email format', () => {
      // Arrange
      const props = {
        email: 'invalid-email',
        onboardingCompleted: false,
      };

      // Act
      const result = User.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_USER');
      expect(result.error?.message).toContain('valid email');
    });

    it('should fail with empty first name when provided', () => {
      // Arrange
      const props = {
        email: 'test@example.com',
        firstName: '   ',
        onboardingCompleted: false,
      };

      // Act
      const result = User.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_USER');
    });

    it('should fail with first name too long', () => {
      // Arrange
      const props = {
        email: 'test@example.com',
        firstName: 'a'.repeat(51),
        onboardingCompleted: false,
      };

      // Act
      const result = User.create(props);

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_USER');
      expect(result.error?.message).toBe('First name too long');
    });

    it('should create user without names', () => {
      // Arrange
      const props = {
        email: 'test@example.com',
        onboardingCompleted: true,
      };

      // Act
      const result = User.create(props);

      // Assert
      expect(result.isOk()).toBe(true);
      const user = result.value!;
      expect(user.firstName).toBeUndefined();
      expect(user.lastName).toBeUndefined();
      expect(user.fullName).toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    let user: User;

    beforeEach(() => {
      const result = User.create({
        email: 'test@example.com',
        onboardingCompleted: false,
      });
      user = result.value!;
    });

    it('should update first and last name', () => {
      // Act
      const result = user.updateProfile('Jane', 'Smith');

      // Assert
      expect(result.isOk()).toBe(true);
      expect(user.firstName).toBe('Jane');
      expect(user.lastName).toBe('Smith');
      expect(user.fullName).toBe('Jane Smith');
    });

    it('should update only first name', () => {
      // Act
      const result = user.updateProfile('Jane', undefined);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(user.firstName).toBe('Jane');
      expect(user.lastName).toBeUndefined();
    });

    it('should fail with empty first name', () => {
      // Act
      const result = user.updateProfile('  ', 'Smith');

      // Assert
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('INVALID_USER_UPDATE');
    });
  });

  describe('completeOnboarding', () => {
    it('should mark onboarding as completed', () => {
      // Arrange
      const user = User.create({
        email: 'test@example.com',
        onboardingCompleted: false,
      }).value!;

      // Act
      const result = user.completeOnboarding();

      // Assert
      expect(result.isOk()).toBe(true);
      expect(user.onboardingCompleted).toBe(true);
      expect(user.metadata.onboardingCompletedAt).toBeDefined();
    });

    it('should be idempotent when already completed', () => {
      // Arrange
      const user = User.create({
        email: 'test@example.com',
        onboardingCompleted: true,
      }).value!;

      // Act
      const result = user.completeOnboarding();

      // Assert
      expect(result.isOk()).toBe(true);
      expect(user.onboardingCompleted).toBe(true);
    });
  });

  describe('business rules', () => {
    it('should consider profile complete with both names', () => {
      // Arrange
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        onboardingCompleted: true,
      }).value!;

      // Act & Assert
      expect(user.isProfileComplete()).toBe(true);
    });

    it('should not consider profile complete without names', () => {
      // Arrange
      const user = User.create({
        email: 'test@example.com',
        onboardingCompleted: true,
      }).value!;

      // Act & Assert
      expect(user.isProfileComplete()).toBe(false);
    });

    it('should allow premium features with complete profile and onboarding', () => {
      // Arrange
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        onboardingCompleted: true,
      }).value!;

      // Act & Assert
      expect(user.canAccessPremiumFeatures()).toBe(true);
    });

    it('should not allow premium features without onboarding', () => {
      // Arrange
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        onboardingCompleted: false,
      }).value!;

      // Act & Assert
      expect(user.canAccessPremiumFeatures()).toBe(false);
    });
  });

  describe('toSnapshot', () => {
    it('should return a complete snapshot', () => {
      // Arrange
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        onboardingCompleted: true,
        metadata: { customField: 'value' },
      }).value!;

      // Act
      const snapshot = user.toSnapshot();

      // Assert
      expect(snapshot).toEqual({
        id: user.id,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        onboardingCompleted: true,
        metadata: { customField: 'value' },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    });
  });
});
