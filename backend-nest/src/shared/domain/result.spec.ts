import { describe, expect, it } from 'bun:test';
import { Result } from './result';

describe('Result', () => {
  describe('success', () => {
    it('should create success result with value', () => {
      const value = { id: 1, name: 'Test' };
      const result = Result.ok(value);

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toEqual(value);
    });

    it('should create success result without value', () => {
      const result = Result.ok();

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should return value when accessing value on success', () => {
      const value = 'success value';
      const result = Result.ok(value);

      expect(result.value).toBe(value);
    });

    it('should throw when accessing error on success', () => {
      const result = Result.ok('value');

      expect(() => result.error).toThrow(
        'Cannot get error from success result',
      );
    });
  });

  describe('failure', () => {
    it('should create failure result with error message', () => {
      const error = 'Something went wrong';
      const result = Result.fail(error);

      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
      expect(() => result.value).toThrow();
    });

    it('should throw when accessing value on failure', () => {
      const result = Result.fail('error');

      expect(() => result.value).toThrow(
        'Cannot get value from failure result',
      );
    });

    it('should return error when accessing error on failure', () => {
      const error = 'error message';
      const result = Result.fail(error);

      expect(result.error).toBe(error);
    });
  });

  describe('combine', () => {
    it('should combine multiple success results', () => {
      const result1 = Result.ok('value1');
      const result2 = Result.ok('value2');
      const result3 = Result.ok('value3');

      const combined = Result.combine([result1, result2, result3]);

      expect(combined.isSuccess).toBe(true);
      expect(combined.value).toBeUndefined();
    });

    it('should return first failure when combining', () => {
      const result1 = Result.ok('value1');
      const result2 = Result.fail('error2');
      const result3 = Result.fail('error3');

      const combined = Result.combine([result1, result2, result3]);

      expect(combined.isFailure).toBe(true);
      expect(combined.error).toBe('error2');
    });

    it('should handle empty array', () => {
      const combined = Result.combine([]);

      expect(combined.isSuccess).toBe(true);
    });
  });

  describe('type guards', () => {
    it('should narrow type with isSuccess check', () => {
      const result = Result.ok('test value');

      if (result.isSuccess) {
        // TypeScript should know result.value is accessible here
        expect(result.value).toBe('test value');
      }
    });

    it('should narrow type with isFailure check', () => {
      const result = Result.fail('test error');

      if (result.isFailure) {
        // TypeScript should know result.error is accessible here
        expect(result.error).toBe('test error');
      }
    });
  });

  describe('chaining operations', () => {
    it('should support method chaining pattern', () => {
      const processValue = (value: number): Result<number> => {
        if (value < 0) {
          return Result.fail('Value must be positive');
        }
        return Result.ok(value * 2);
      };

      const result1 = processValue(5);
      expect(result1.isSuccess).toBe(true);
      expect(result1.value).toBe(10);

      const result2 = processValue(-5);
      expect(result2.isFailure).toBe(true);
      expect(result2.error).toBe('Value must be positive');
    });
  });
});
