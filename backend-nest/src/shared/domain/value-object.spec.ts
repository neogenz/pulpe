import { describe, expect, it } from 'bun:test';
import { ValueObject } from './value-object';

// Test implementations
interface EmailProps {
  value: string;
}

class Email extends ValueObject<EmailProps> {
  get value(): string {
    return this.props.value;
  }

  static create(email: string): Email {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Invalid email format');
    }

    return new Email({ value: normalizedEmail });
  }
}

interface MoneyProps {
  amount: number;
  currency: string;
}

class Money extends ValueObject<MoneyProps> {
  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-letter code');
    }

    return new Money({ amount, currency: currency.toUpperCase() });
  }
}

describe('ValueObject', () => {
  describe('equality', () => {
    it('should be equal when all props are the same', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('TEST@EXAMPLE.COM');

      expect(email1.equals(email2)).toBe(true);
    });

    it('should not be equal when props are different', () => {
      const email1 = Email.create('test1@example.com');
      const email2 = Email.create('test2@example.com');

      expect(email1.equals(email2)).toBe(false);
    });

    it('should be equal for complex value objects', () => {
      const money1 = Money.create(100, 'usd');
      const money2 = Money.create(100, 'USD');

      expect(money1.equals(money2)).toBe(true);
    });

    it('should not be equal when any prop differs', () => {
      const money1 = Money.create(100, 'USD');
      const money2 = Money.create(100, 'EUR');

      expect(money1.equals(money2)).toBe(false);
    });

    it('should not be equal to undefined', () => {
      const email = Email.create('test@example.com');

      expect(email.equals(undefined)).toBe(false);
    });

    it('should not be equal to null', () => {
      const email = Email.create('test@example.com');

      expect(email.equals(null as any)).toBe(false);
    });

    it('should not be equal to different value object type', () => {
      const email = Email.create('test@example.com');
      const money = Money.create(100, 'USD');

      expect(email.equals(money as any)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should have frozen props', () => {
      const email = Email.create('test@example.com');

      expect(() => {
        (email as any).props.value = 'changed@example.com';
      }).toThrow();
    });

    it('should have frozen nested props', () => {
      const money = Money.create(100, 'USD');

      expect(() => {
        (money as any).props.amount = 200;
      }).toThrow();
    });
  });

  describe('validation', () => {
    it('should validate on creation', () => {
      expect(() => Email.create('')).toThrow('Invalid email format');
      expect(() => Email.create('invalid')).toThrow('Invalid email format');
      expect(() => Money.create(-10, 'USD')).toThrow(
        'Amount cannot be negative',
      );
      expect(() => Money.create(100, 'US')).toThrow(
        'Currency must be a 3-letter code',
      );
    });

    it('should normalize values on creation', () => {
      const email = Email.create('  TEST@EXAMPLE.COM  ');
      expect(email.value).toBe('test@example.com');

      const money = Money.create(100, 'usd');
      expect(money.currency).toBe('USD');
    });
  });
});
