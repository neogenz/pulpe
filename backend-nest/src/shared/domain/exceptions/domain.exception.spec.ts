import { describe, expect, it } from 'bun:test';
import {
  DomainException,
  EntityNotFoundException,
  ValidationException,
  BusinessRuleViolationException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from './domain.exception';

describe('DomainException', () => {
  // Test concrete implementation
  class TestException extends DomainException {
    constructor() {
      super('Test error', 'TEST_ERROR', 500);
    }
  }

  it('should create exception with all properties', () => {
    const exception = new TestException();

    expect(exception.message).toBe('Test error');
    expect(exception.code).toBe('TEST_ERROR');
    expect(exception.statusCode).toBe(500);
    expect(exception.name).toBe('TestException');
    expect(exception.timestamp).toBeInstanceOf(Date);
  });

  it('should serialize to JSON correctly', () => {
    const exception = new TestException();
    const json = exception.toJSON();

    expect(json).toEqual({
      name: 'TestException',
      message: 'Test error',
      code: 'TEST_ERROR',
      statusCode: 500,
      timestamp: exception.timestamp,
    });
  });
});

describe('EntityNotFoundException', () => {
  it('should create exception with entity info', () => {
    const exception = new EntityNotFoundException('User', '123');

    expect(exception.message).toBe('User with id 123 not found');
    expect(exception.code).toBe('ENTITY_NOT_FOUND');
    expect(exception.statusCode).toBe(404);
  });
});

describe('ValidationException', () => {
  it('should create exception with validation errors', () => {
    const errors = {
      email: ['Email is required', 'Email format is invalid'],
      age: ['Age must be positive'],
    };
    const exception = new ValidationException(errors);

    expect(exception.message).toBe('Validation failed');
    expect(exception.code).toBe('VALIDATION_FAILED');
    expect(exception.statusCode).toBe(400);
    expect(exception.errors).toEqual(errors);
  });

  it('should serialize to JSON with errors', () => {
    const errors = {
      email: ['Email is required'],
    };
    const exception = new ValidationException(errors);
    const json = exception.toJSON();

    expect(json.errors).toEqual(errors);
    expect(json.name).toBe('ValidationException');
  });
});

describe('BusinessRuleViolationException', () => {
  it('should create exception with custom message', () => {
    const exception = new BusinessRuleViolationException(
      'Cannot withdraw more than available balance',
    );

    expect(exception.message).toBe(
      'Cannot withdraw more than available balance',
    );
    expect(exception.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(exception.statusCode).toBe(422);
  });
});

describe('ConflictException', () => {
  it('should create exception for conflicts', () => {
    const exception = new ConflictException('Resource already exists');

    expect(exception.message).toBe('Resource already exists');
    expect(exception.code).toBe('CONFLICT');
    expect(exception.statusCode).toBe(409);
  });
});

describe('UnauthorizedException', () => {
  it('should create exception with default message', () => {
    const exception = new UnauthorizedException();

    expect(exception.message).toBe('Unauthorized');
    expect(exception.code).toBe('UNAUTHORIZED');
    expect(exception.statusCode).toBe(401);
  });

  it('should create exception with custom message', () => {
    const exception = new UnauthorizedException('Invalid token');

    expect(exception.message).toBe('Invalid token');
  });
});

describe('ForbiddenException', () => {
  it('should create exception with default message', () => {
    const exception = new ForbiddenException();

    expect(exception.message).toBe('Forbidden');
    expect(exception.code).toBe('FORBIDDEN');
    expect(exception.statusCode).toBe(403);
  });

  it('should create exception with custom message', () => {
    const exception = new ForbiddenException('Access denied to resource');

    expect(exception.message).toBe('Access denied to resource');
  });
});
