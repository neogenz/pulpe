import { describe, it, expect } from 'vitest';
import {
  uint8ArrayToHex,
  hexToUint8Array,
  deriveClientKey,
  generateRandomKeyHex,
  isValidClientKeyHex,
} from './crypto.utils';

describe('uint8ArrayToHex', () => {
  it('converts bytes to hex string correctly', () => {
    const bytes = new Uint8Array([0xff, 0x00, 0x1a, 0xab]);
    expect(uint8ArrayToHex(bytes)).toBe('ff001aab');
  });

  it('handles single byte', () => {
    const bytes = new Uint8Array([0xff]);
    expect(uint8ArrayToHex(bytes)).toBe('ff');
  });

  it('handles empty array', () => {
    const bytes = new Uint8Array([]);
    expect(uint8ArrayToHex(bytes)).toBe('');
  });

  it('pads single-digit hex values with leading zero', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x0f]);
    expect(uint8ArrayToHex(bytes)).toBe('0001020f');
  });
});

describe('hexToUint8Array', () => {
  it('converts hex string to bytes correctly', () => {
    const hex = 'ff001aab';
    const result = hexToUint8Array(hex);
    expect(result).toEqual(new Uint8Array([0xff, 0x00, 0x1a, 0xab]));
  });

  it('handles empty string', () => {
    const result = hexToUint8Array('');
    expect(result).toEqual(new Uint8Array([]));
  });

  it('handles single byte hex', () => {
    const result = hexToUint8Array('ff');
    expect(result).toEqual(new Uint8Array([0xff]));
  });

  it('roundtrips with uint8ArrayToHex', () => {
    const original = new Uint8Array([0xff, 0x00, 0x1a, 0xab, 0x12, 0x34]);
    const hex = uint8ArrayToHex(original);
    const restored = hexToUint8Array(hex);
    expect(restored).toEqual(original);
  });

  it('handles leading zeros correctly', () => {
    const hex = '0001020f';
    const result = hexToUint8Array(hex);
    expect(result).toEqual(new Uint8Array([0x00, 0x01, 0x02, 0x0f]));
  });
});

describe('deriveClientKey', () => {
  it('returns 64-character hex string', async () => {
    const password = 'test-password';
    const salt = 'a'.repeat(64);
    const iterations = 100000;

    const key = await deriveClientKey(password, salt, iterations);

    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true);
  });

  it('is deterministic with same inputs', async () => {
    const password = 'test-password';
    const salt = 'b'.repeat(64);
    const iterations = 100000;

    const key1 = await deriveClientKey(password, salt, iterations);
    const key2 = await deriveClientKey(password, salt, iterations);

    expect(key1).toBe(key2);
  });

  it('produces different key with different password', async () => {
    const salt = 'c'.repeat(64);
    const iterations = 100000;

    const key1 = await deriveClientKey('password1', salt, iterations);
    const key2 = await deriveClientKey('password2', salt, iterations);

    expect(key1).not.toBe(key2);
  });

  it('produces different key with different salt', async () => {
    const password = 'test-password';
    const iterations = 100000;

    const key1 = await deriveClientKey(password, 'd'.repeat(64), iterations);
    const key2 = await deriveClientKey(password, 'e'.repeat(64), iterations);

    expect(key1).not.toBe(key2);
  });

  it('produces different key with different iterations', async () => {
    const password = 'test-password';
    const salt = 'f'.repeat(64);

    const key1 = await deriveClientKey(password, salt, 100000);
    const key2 = await deriveClientKey(password, salt, 200000);

    expect(key1).not.toBe(key2);
  });
});

describe('generateRandomKeyHex', () => {
  it('returns 64-character hex string', () => {
    const key = generateRandomKeyHex();

    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true);
  });

  it('returns valid hex characters only', () => {
    const key = generateRandomKeyHex();
    expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
  });

  it('produces different output on each call', () => {
    const key1 = generateRandomKeyHex();
    const key2 = generateRandomKeyHex();
    const key3 = generateRandomKeyHex();

    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
    expect(key1).not.toBe(key3);
  });
});

describe('isValidClientKeyHex', () => {
  it('accepts valid 64-character hex string', () => {
    const validKey = 'a'.repeat(64);
    expect(isValidClientKeyHex(validKey)).toBe(true);
  });

  it('accepts mixed case hex', () => {
    const validKey = 'AbCdEf1234567890'.repeat(4);
    expect(isValidClientKeyHex(validKey)).toBe(true);
  });

  it('rejects string shorter than 64 characters', () => {
    const shortKey = 'a'.repeat(63);
    expect(isValidClientKeyHex(shortKey)).toBe(false);
  });

  it('rejects string longer than 64 characters', () => {
    const longKey = 'a'.repeat(65);
    expect(isValidClientKeyHex(longKey)).toBe(false);
  });

  it('rejects non-hex characters', () => {
    const invalidKey = 'g'.repeat(64);
    expect(isValidClientKeyHex(invalidKey)).toBe(false);
  });

  it('rejects string with spaces', () => {
    const invalidKey = 'a'.repeat(32) + ' ' + 'a'.repeat(31);
    expect(isValidClientKeyHex(invalidKey)).toBe(false);
  });

  it('rejects all-zeros string', () => {
    const allZeros = '0'.repeat(64);
    expect(isValidClientKeyHex(allZeros)).toBe(false);
  });

  it('accepts valid key from generateRandomKeyHex', () => {
    const key = generateRandomKeyHex();
    expect(isValidClientKeyHex(key)).toBe(true);
  });
});
