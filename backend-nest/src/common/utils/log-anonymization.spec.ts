import { describe, it, expect } from 'bun:test';
import { anonymizeIp, parseDeviceType } from './log-anonymization';

describe('anonymizeIp', () => {
  it('should return undefined for undefined input', () => {
    expect(anonymizeIp(undefined)).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(anonymizeIp('')).toBeUndefined();
  });

  it('should anonymize IPv4 address', () => {
    expect(anonymizeIp('192.168.1.100')).toBe('192.168.x.x');
  });

  it('should anonymize IPv4 address with different octets', () => {
    expect(anonymizeIp('10.0.0.1')).toBe('10.0.x.x');
    expect(anonymizeIp('172.16.254.1')).toBe('172.16.x.x');
  });

  it('should handle x-forwarded-for with multiple IPs', () => {
    expect(anonymizeIp('192.168.1.100, 10.0.0.1')).toBe('192.168.x.x');
    expect(anonymizeIp('203.0.113.50, 192.0.2.1, 198.51.100.1')).toBe(
      '203.0.x.x',
    );
  });

  it('should anonymize IPv6 address', () => {
    expect(anonymizeIp('2001:0db8:85a3::8a2e:0370:7334')).toBe('2001:0db8::x');
  });

  it('should anonymize shortened IPv6 address', () => {
    expect(anonymizeIp('::1')).toBe(':::x');
  });

  it('should return [IP_REDACTED] for invalid format', () => {
    expect(anonymizeIp('invalid')).toBe('[IP_REDACTED]');
    expect(anonymizeIp('192.168.1')).toBe('[IP_REDACTED]');
  });

  it('should handle whitespace in x-forwarded-for', () => {
    expect(anonymizeIp('  192.168.1.100  ')).toBe('192.168.x.x');
    expect(anonymizeIp('  192.168.1.100  ,  10.0.0.1  ')).toBe('192.168.x.x');
  });
});

describe('parseDeviceType', () => {
  it('should return unknown for undefined input', () => {
    expect(parseDeviceType(undefined)).toBe('unknown');
  });

  it('should return unknown for empty string', () => {
    expect(parseDeviceType('')).toBe('unknown');
  });

  it('should detect mobile from iPhone user agent', () => {
    const iPhoneUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(parseDeviceType(iPhoneUA)).toBe('mobile');
  });

  it('should detect mobile from Android phone user agent', () => {
    const androidUA =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36';
    expect(parseDeviceType(androidUA)).toBe('mobile');
  });

  it('should detect mobile from generic mobile user agent', () => {
    const mobileUA = 'Mozilla/5.0 Mobile Safari/537.36';
    expect(parseDeviceType(mobileUA)).toBe('mobile');
  });

  it('should detect tablet from iPad user agent', () => {
    const iPadUA =
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(parseDeviceType(iPadUA)).toBe('tablet');
  });

  it('should detect tablet from generic tablet user agent', () => {
    const tabletUA = 'Mozilla/5.0 (Linux; Android 13) Tablet Safari/537.36';
    expect(parseDeviceType(tabletUA)).toBe('tablet');
  });

  it('should detect desktop from Chrome user agent', () => {
    const chromeUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
    expect(parseDeviceType(chromeUA)).toBe('desktop');
  });

  it('should detect desktop from Firefox user agent', () => {
    const firefoxUA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0';
    expect(parseDeviceType(firefoxUA)).toBe('desktop');
  });

  it('should be case insensitive', () => {
    expect(parseDeviceType('IPHONE')).toBe('mobile');
    expect(parseDeviceType('IPAD')).toBe('tablet');
    expect(parseDeviceType('ANDROID')).toBe('mobile');
  });
});
