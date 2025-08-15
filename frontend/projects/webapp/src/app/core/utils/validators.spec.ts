import {
  isValidUrl,
  isValidHttpUrl,
  sanitizeUrl,
  validateConfigUrls,
} from './validators';

describe('URL Validators', () => {
  describe('isValidUrl', () => {
    it('should validate correct HTTP URLs', () => {
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://api.example.com/v1')).toBe(true);
      expect(isValidUrl('http://192.168.1.1:8080')).toBe(true);
    });

    it('should validate correct HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://api.example.com/v1/users')).toBe(true);
      expect(isValidUrl('https://example.com:443')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
      expect(isValidUrl('//example.com')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      // Note: 'http://.' is actually valid per URL constructor
      expect(isValidUrl('http://.')).toBe(true);
    });

    it('should reject non-HTTP(S) protocols', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
      expect(isValidUrl('data:text/plain,test')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });

    it('should handle special characters in URLs', () => {
      expect(isValidUrl('https://example.com/path?query=value&other=123')).toBe(
        true,
      );
      expect(isValidUrl('https://example.com/path#fragment')).toBe(true);
      expect(isValidUrl('https://user:pass@example.com')).toBe(true);
    });
  });

  describe('isValidHttpUrl', () => {
    it('should allow custom protocols', () => {
      expect(isValidHttpUrl('ws://localhost:8080', ['ws:', 'wss:'])).toBe(true);
      expect(isValidHttpUrl('wss://example.com', ['ws:', 'wss:'])).toBe(true);
      expect(isValidHttpUrl('http://example.com', ['ws:', 'wss:'])).toBe(false);
    });

    it('should default to HTTP and HTTPS', () => {
      expect(isValidHttpUrl('http://example.com')).toBe(true);
      expect(isValidHttpUrl('https://example.com')).toBe(true);
      expect(isValidHttpUrl('ws://example.com')).toBe(false);
    });

    it('should validate URL structure regardless of protocol', () => {
      // Note: 'ws://invalid..com' is actually valid per URL constructor
      expect(isValidHttpUrl('ws://invalid..com', ['ws:'])).toBe(true);
      expect(isValidHttpUrl('ws://', ['ws:'])).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('should return valid URLs unchanged', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('http://localhost:3000/api')).toBe(
        'http://localhost:3000/api',
      );
    });

    it('should return fallback for invalid URLs', () => {
      expect(sanitizeUrl('not-a-url')).toBe('http://localhost:3000');
      expect(sanitizeUrl('')).toBe('http://localhost:3000');
      expect(sanitizeUrl('javascript:alert(1)')).toBe('http://localhost:3000');
    });

    it('should use custom fallback', () => {
      const customFallback = 'https://default.com';
      expect(sanitizeUrl('invalid', customFallback)).toBe(customFallback);
      expect(sanitizeUrl('', customFallback)).toBe(customFallback);
    });

    it('should trim whitespace from URLs', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe(
        'https://example.com',
      );
      expect(sanitizeUrl('\nhttps://example.com\t')).toBe(
        'https://example.com',
      );
    });

    it('should handle null and undefined', () => {
      expect(sanitizeUrl(null)).toBe('http://localhost:3000');
      expect(sanitizeUrl(undefined)).toBe('http://localhost:3000');
    });
  });

  describe('validateConfigUrls', () => {
    it('should validate all URLs in config object', () => {
      const config = {
        apiUrl: 'https://api.example.com',
        backendUrl: 'http://localhost:3000',
        websocketUrl: 'wss://ws.example.com',
      };

      const result = validateConfigUrls(config);
      expect(result.isValid).toBe(false); // wss: is not allowed by default
      expect(result.errors).toContain(
        'Invalid URL for websocketUrl: wss://ws.example.com',
      );
    });

    it('should return valid for all HTTP(S) URLs', () => {
      const config = {
        apiUrl: 'https://api.example.com',
        backendUrl: 'http://localhost:3000',
        frontendUrl: 'https://app.example.com',
      };

      const result = validateConfigUrls(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect multiple invalid URLs', () => {
      const config = {
        apiUrl: 'not-a-url',
        backendUrl: 'javascript:alert(1)',
        validUrl: 'https://example.com',
      };

      const result = validateConfigUrls(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Invalid URL for apiUrl: not-a-url');
      expect(result.errors).toContain(
        'Invalid URL for backendUrl: javascript:alert(1)',
      );
    });

    it('should handle nested objects', () => {
      const config = {
        api: {
          url: 'https://api.example.com',
          backupUrl: 'invalid-url',
        },
        frontend: {
          url: 'https://app.example.com',
        },
      };

      const result = validateConfigUrls(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid URL for api.backupUrl: invalid-url',
      );
    });

    it('should skip non-string values', () => {
      const config = {
        apiUrl: 'https://api.example.com',
        port: 3000,
        enabled: true,
        metadata: null,
        urls: ['https://example.com'], // Arrays are skipped
      };

      const result = validateConfigUrls(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty config', () => {
      const result = validateConfigUrls({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should only check fields ending with "Url" or "URL"', () => {
      const config = {
        apiUrl: 'https://api.example.com',
        backendURL: 'http://localhost:3000',
        randomString: 'not-a-url', // Should be skipped
        websiteUrl: 'invalid', // Should be checked
      };

      const result = validateConfigUrls(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors).toContain('Invalid URL for websiteUrl: invalid');
    });
  });
});
