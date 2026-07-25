import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly accessToken: string;
  readonly clientKey: Buffer;
  /**
   * Jour de paie, déjà chargé par le guard avec le reste des métadonnées.
   * Optionnel pour ne pas imposer sa présence aux fabriques de tests : absent
   * vaut `null`, que `getBudgetPeriodForDate` traite en comportement calendaire.
   */
  readonly payDayOfMonth?: number | null;
}

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export const SupabaseClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.supabase;
  },
);
