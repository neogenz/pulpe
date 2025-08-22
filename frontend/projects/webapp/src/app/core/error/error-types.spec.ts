import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect } from 'vitest';
import {
  ErrorCategory,
  isHttpError,
  isError,
  isDOMException,
  isNetworkError,
  isValidationError,
  isBusinessError,
  categorizeError,
  isRetryableError,
  extractErrorMessage,
  extractErrorCode,
  createPulpeError,
} from './error-types';

describe('Error Types', () => {
  describe('Type Guards', () => {
    it('should identify HttpErrorResponse', () => {
      const httpError = new HttpErrorResponse({ status: 404 });
      const normalError = new Error('test');

      expect(isHttpError(httpError)).toBe(true);
      expect(isHttpError(normalError)).toBe(false);
      expect(isHttpError('string')).toBe(false);
    });

    it('should identify Error instances', () => {
      const error = new Error('test');
      const httpError = new HttpErrorResponse({ status: 404 });

      expect(isError(error)).toBe(true);
      expect(isError(httpError)).toBe(true); // HttpErrorResponse extends Error
      expect(isError('string')).toBe(false);
    });

    it('should identify DOMException', () => {
      const domException = new DOMException('test');
      const normalError = new Error('test');

      expect(isDOMException(domException)).toBe(true);
      expect(isDOMException(normalError)).toBe(false);
    });
  });

  describe('Error Classification', () => {
    it('should identify network errors', () => {
      const networkError = new HttpErrorResponse({ status: 0 });
      const serverError = new HttpErrorResponse({ status: 500 });
      const clientError = new HttpErrorResponse({ status: 400 });

      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(serverError)).toBe(true);
      expect(isNetworkError(clientError)).toBe(false);

      const networkErrorMessage = new Error('Network request failed');
      expect(isNetworkError(networkErrorMessage)).toBe(true);
    });

    it('should identify validation errors', () => {
      const validationError = new HttpErrorResponse({ status: 400 });
      const unprocessableEntity = new HttpErrorResponse({ status: 422 });
      const serverError = new HttpErrorResponse({ status: 500 });

      expect(isValidationError(validationError)).toBe(true);
      expect(isValidationError(unprocessableEntity)).toBe(true);
      expect(isValidationError(serverError)).toBe(false);

      const validationErrorMessage = new Error('Validation failed');
      expect(isValidationError(validationErrorMessage)).toBe(true);
    });

    it('should identify business errors', () => {
      const forbiddenError = new HttpErrorResponse({ status: 403 });
      const conflictError = new HttpErrorResponse({ status: 409 });
      const notFoundError = new HttpErrorResponse({ status: 404 });

      expect(isBusinessError(forbiddenError)).toBe(true);
      expect(isBusinessError(conflictError)).toBe(true);
      expect(isBusinessError(notFoundError)).toBe(false);

      const businessErrorMessage = new Error('Operation not allowed');
      expect(isBusinessError(businessErrorMessage)).toBe(true);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize errors correctly', () => {
      expect(categorizeError(new HttpErrorResponse({ status: 0 }))).toBe(
        ErrorCategory.NETWORK,
      );
      expect(categorizeError(new HttpErrorResponse({ status: 400 }))).toBe(
        ErrorCategory.VALIDATION,
      );
      expect(categorizeError(new HttpErrorResponse({ status: 403 }))).toBe(
        ErrorCategory.BUSINESS,
      );
      expect(categorizeError(new HttpErrorResponse({ status: 500 }))).toBe(
        ErrorCategory.SYSTEM,
      );
      expect(categorizeError('unknown error')).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe('Retryable Errors', () => {
    it('should identify retryable errors', () => {
      const retryableErrors = [
        new HttpErrorResponse({ status: 0 }), // Network
        new HttpErrorResponse({ status: 408 }), // Timeout
        new HttpErrorResponse({ status: 429 }), // Too Many Requests
        new HttpErrorResponse({ status: 502 }), // Bad Gateway
        new HttpErrorResponse({ status: 503 }), // Service Unavailable
        new HttpErrorResponse({ status: 504 }), // Gateway Timeout
      ];

      retryableErrors.forEach((error) => {
        expect(isRetryableError(error)).toBe(true);
      });

      const nonRetryableErrors = [
        new HttpErrorResponse({ status: 400 }), // Bad Request
        new HttpErrorResponse({ status: 401 }), // Unauthorized
        new HttpErrorResponse({ status: 403 }), // Forbidden
        new HttpErrorResponse({ status: 404 }), // Not Found
      ];

      nonRetryableErrors.forEach((error) => {
        expect(isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('Error Message Extraction', () => {
    it('should extract message from HttpErrorResponse', () => {
      const errorWithMessage = new HttpErrorResponse({
        status: 400,
        error: { message: 'Invalid input' },
      });
      expect(extractErrorMessage(errorWithMessage)).toBe('Invalid input');

      const errorWithErrorField = new HttpErrorResponse({
        status: 400,
        error: { error: 'Bad request' },
      });
      expect(extractErrorMessage(errorWithErrorField)).toBe('Bad request');

      const errorWithStringBody = new HttpErrorResponse({
        status: 400,
        error: 'String error',
      });
      expect(extractErrorMessage(errorWithStringBody)).toBe('String error');

      const errorWithStatusText = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
      });
      expect(extractErrorMessage(errorWithStatusText)).toBe('Bad Request');
    });

    it('should extract message from Error instances', () => {
      const error = new Error('Test error message');
      expect(extractErrorMessage(error)).toBe('Test error message');
    });

    it('should handle string errors', () => {
      expect(extractErrorMessage('String error')).toBe('String error');
    });

    it('should handle unknown error types', () => {
      expect(extractErrorMessage(null)).toBe('An unknown error occurred');
      expect(extractErrorMessage(undefined)).toBe('An unknown error occurred');
      expect(extractErrorMessage(123)).toBe('An unknown error occurred');
    });
  });

  describe('Error Code Extraction', () => {
    it('should extract code from HttpErrorResponse', () => {
      const errorWithCode = new HttpErrorResponse({
        status: 400,
        error: { code: 'INVALID_INPUT' },
      });
      expect(extractErrorCode(errorWithCode)).toBe('INVALID_INPUT');

      const errorWithoutCode = new HttpErrorResponse({
        status: 404,
      });
      expect(extractErrorCode(errorWithoutCode)).toBe('HTTP_404');
    });

    it('should extract code from Error with code property', () => {
      const error = Object.assign(new Error('Test'), { code: 'TEST_CODE' });
      expect(extractErrorCode(error)).toBe('TEST_CODE');
    });

    it('should return undefined for errors without code', () => {
      expect(extractErrorCode(new Error('Test'))).toBeUndefined();
      expect(extractErrorCode('string error')).toBeUndefined();
    });
  });

  describe('PulpeError Creation', () => {
    it('should create PulpeError from HttpErrorResponse', () => {
      const httpError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://api.example.com/endpoint',
        error: { message: 'Database connection failed' },
      });

      const pulpeError = createPulpeError(httpError);

      expect(pulpeError.category).toBe(ErrorCategory.SYSTEM);
      expect(pulpeError.message).toBe('Database connection failed');
      expect(pulpeError.code).toBe('HTTP_500');
      expect(pulpeError.retryable).toBe(true);
      expect(pulpeError.originalError).toBe(httpError);
      expect(pulpeError.context?.url).toBe('https://api.example.com/endpoint');
      expect(pulpeError.context?.status).toBe(500);
      expect(pulpeError.timestamp).toBeInstanceOf(Date);
    });

    it('should create PulpeError from Error', () => {
      const error = new Error('Test error');
      const pulpeError = createPulpeError(error);

      expect(pulpeError.category).toBe(ErrorCategory.UNKNOWN);
      expect(pulpeError.message).toBe('Test error');
      expect(pulpeError.retryable).toBe(false);
      expect(pulpeError.originalError).toBe(error);
      expect(pulpeError.stack).toBe(error.stack);
    });

    it('should create PulpeError from string', () => {
      const pulpeError = createPulpeError('String error');

      expect(pulpeError.category).toBe(ErrorCategory.UNKNOWN);
      expect(pulpeError.message).toBe('String error');
      expect(pulpeError.retryable).toBe(false);
      expect(pulpeError.originalError).toBe('String error');
    });
  });
});
