import { Inject, Injectable } from '@nestjs/common';
import type { SupportedCurrency } from 'pulpe-shared';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '@modules/user/domain/ports/user-repository.port';

/**
 * The four currency fields the write schemas expect. Present together or not at
 * all — a half-filled quadruplet violates the `fx_metadata_coherent` constraint.
 */
export interface AgentAmount {
  readonly amount: number;
  readonly originalAmount?: number;
  readonly originalCurrency?: SupportedCurrency;
  readonly targetCurrency?: SupportedCurrency;
  readonly exchangeRate?: number;
}

@Injectable()
export class ResolveCurrencyUseCase {
  constructor(
    private readonly currency: CurrencyService,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
  ) {}

  /**
   * An agent says "42 euros" or just "42". Unnamed means the currency of the
   * user's settings, and carries no exchange metadata at all. Named and
   * different means a real conversion: the stored amount is the converted one,
   * the quoted amount survives beside it. A currency Pulpe does not support
   * never reaches here — the tool schemas only accept CHF and EUR, so the call
   * is refused before anything is written.
   */
  async execute(
    amount: number,
    currency?: SupportedCurrency,
  ): Promise<AgentAmount> {
    const settings = await this.users.findSettings();
    if (!currency || currency === settings.currency) {
      return { amount };
    }
    const { rate } = await this.currency.getRate(currency, settings.currency);
    return {
      amount: Number((amount * rate).toFixed(2)),
      originalAmount: amount,
      originalCurrency: currency,
      targetCurrency: settings.currency,
      exchangeRate: rate,
    };
  }
}
