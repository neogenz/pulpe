import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  DomainException,
  EntityNotFoundException,
  ValidationException,
  BusinessRuleViolationException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  DatabaseException,
  ExternalServiceException,
  TimeoutException,
  RateLimitException,
  InvalidOperationException,
  MissingDataException,
} from './domain.exception';

describe('Domain Exceptions', () => {
  describe('DomainException (Base)', () => {
    class TestException extends DomainException {
      constructor() {
        super('Test message', 'TEST_CODE', 418);
      }
    }

    it('should create exception with correct properties', () => {
      const exception = new TestException();

      expect(exception.message).toBe('Test message');
      expect(exception.code).toBe('TEST_CODE');
      expect(exception.statusCode).toBe(418);
      expect(exception.name).toBe('TestException');
      expect(exception.timestamp).toBeInstanceOf(Date);
      expect(exception.stack).toBeDefined();
    });

    it('should serialize to JSON correctly', () => {
      const exception = new TestException();
      const json = exception.toJSON();

      expect(json).toEqual({
        name: 'TestException',
        message: 'Test message',
        code: 'TEST_CODE',
        statusCode: 418,
        timestamp: exception.timestamp,
      });
    });
  });

  describe('EntityNotFoundException', () => {
    it('should create exception with entity details', () => {
      const exception = new EntityNotFoundException('Budget', '123');

      expect(exception.message).toBe('Budget with id 123 not found');
      expect(exception.code).toBe('ENTITY_NOT_FOUND');
      expect(exception.statusCode).toBe(404);
    });
  });

  describe('ValidationException', () => {
    it('should create exception with validation errors', () => {
      const errors = {
        email: ['Invalid email format', 'Email is required'],
        password: ['Password too short'],
      };
      const exception = new ValidationException(errors);

      expect(exception.message).toBe('Validation failed');
      expect(exception.code).toBe('VALIDATION_FAILED');
      expect(exception.statusCode).toBe(400);
      expect(exception.errors).toEqual(errors);
    });

    it('should include errors in JSON serialization', () => {
      const errors = { field: ['error1', 'error2'] };
      const exception = new ValidationException(errors);
      const json = exception.toJSON();

      expect(json.errors).toEqual(errors);
    });
  });

  describe('BusinessRuleViolationException', () => {
    it('should create exception with custom message', () => {
      const exception = new BusinessRuleViolationException(
        'Budget limit exceeded',
      );

      expect(exception.message).toBe('Budget limit exceeded');
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
      const exception = new ForbiddenException('Insufficient permissions');

      expect(exception.message).toBe('Insufficient permissions');
    });
  });

  describe('DatabaseException', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should create exception with operation details', () => {
      const exception = new DatabaseException(
        'Connection failed',
        'SELECT',
        'SELECT * FROM users',
      );

      expect(exception.message).toBe('Connection failed');
      expect(exception.code).toBe('DATABASE_ERROR');
      expect(exception.statusCode).toBe(500);
      expect(exception.operation).toBe('SELECT');
      expect(exception.query).toBe('SELECT * FROM users');
    });

    it('should include query in JSON only in development', () => {
      const exception = new DatabaseException(
        'Error',
        'INSERT',
        'INSERT INTO users ...',
      );

      // In development
      let json = exception.toJSON();
      expect(json.operation).toBe('INSERT');
      expect(json.query).toBe('INSERT INTO users ...');

      // In production
      process.env.NODE_ENV = 'production';
      json = exception.toJSON();
      expect(json.operation).toBe('INSERT');
      expect(json.query).toBeUndefined();
    });
  });

  describe('ExternalServiceException', () => {
    it('should create exception with service details', () => {
      const exception = new ExternalServiceException(
        'PaymentAPI',
        'Connection timeout',
        '/api/v1/process',
      );

      expect(exception.message).toBe(
        'External service error (PaymentAPI): Connection timeout',
      );
      expect(exception.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(exception.statusCode).toBe(502);
      expect(exception.service).toBe('PaymentAPI');
      expect(exception.endpoint).toBe('/api/v1/process');
    });

    it('should include service details in JSON', () => {
      const exception = new ExternalServiceException(
        'API',
        'Error',
        '/endpoint',
      );
      const json = exception.toJSON();

      expect(json.service).toBe('API');
      expect(json.endpoint).toBe('/endpoint');
    });
  });

  describe('TimeoutException', () => {
    it('should create exception with timeout details', () => {
      const exception = new TimeoutException('fetchUserData', 5000);

      expect(exception.message).toBe(
        "Operation 'fetchUserData' timed out after 5000ms",
      );
      expect(exception.code).toBe('TIMEOUT');
      expect(exception.statusCode).toBe(504);
      expect(exception.operation).toBe('fetchUserData');
      expect(exception.timeoutMs).toBe(5000);
    });

    it('should include timeout details in JSON', () => {
      const exception = new TimeoutException('operation', 3000);
      const json = exception.toJSON();

      expect(json.operation).toBe('operation');
      expect(json.timeoutMs).toBe(3000);
    });
  });

  describe('RateLimitException', () => {
    it('should create exception with rate limit details', () => {
      const exception = new RateLimitException(100, 60000, 45);

      expect(exception.message).toBe(
        'Rate limit exceeded: 100 requests per 60s',
      );
      expect(exception.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(exception.statusCode).toBe(429);
      expect(exception.limit).toBe(100);
      expect(exception.windowMs).toBe(60000);
      expect(exception.retryAfter).toBe(45);
    });

    it('should include rate limit details in JSON', () => {
      const exception = new RateLimitException(10, 1000);
      const json = exception.toJSON();

      expect(json.limit).toBe(10);
      expect(json.windowMs).toBe(1000);
      expect(json.retryAfter).toBeUndefined();
    });
  });

  describe('InvalidOperationException', () => {
    it('should create exception for invalid operations', () => {
      const exception = new InvalidOperationException(
        'Cannot delete active budget',
      );

      expect(exception.message).toBe('Cannot delete active budget');
      expect(exception.code).toBe('INVALID_OPERATION');
      expect(exception.statusCode).toBe(422);
    });
  });

  describe('MissingDataException', () => {
    it('should create exception with field details', () => {
      const exception = new MissingDataException('userId');

      expect(exception.message).toBe('Required data missing: userId');
      expect(exception.code).toBe('MISSING_DATA');
      expect(exception.statusCode).toBe(400);
      expect(exception.field).toBe('userId');
    });

    it('should include field in JSON', () => {
      const exception = new MissingDataException('email');
      const json = exception.toJSON();

      expect(json.field).toBe('email');
    });
  });

  describe('Exception Hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const dbException = new DatabaseException('Error');
      const serviceException = new ExternalServiceException('Service', 'Error');
      const rateException = new RateLimitException(10, 1000);

      // Infrastructure exceptions
      expect(dbException).toBeInstanceOf(DomainException);
      expect(dbException).toBeInstanceOf(Error);
      expect(serviceException).toBeInstanceOf(DomainException);
      expect(serviceException).toBeInstanceOf(Error);

      // Application exceptions
      expect(rateException).toBeInstanceOf(DomainException);
      expect(rateException).toBeInstanceOf(Error);
    });
  });
});
