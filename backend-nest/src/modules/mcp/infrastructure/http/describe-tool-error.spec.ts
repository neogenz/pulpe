import { describe, expect, it } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { agentError } from '../../domain/agent-error';
import { describeToolError } from './describe-tool-error';

const ID = '11111111-1111-4111-8111-111111111111';
const refusal = (
  definition: (typeof ERROR_DEFINITIONS)[keyof typeof ERROR_DEFINITIONS],
  details?: Record<string, unknown>,
) => describeToolError(new BusinessException(definition, details));

describe('describeToolError', () => {
  it('names a movement, never a transaction, when the id is unknown', () => {
    const text = refusal(ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND, { id: ID });

    expect(text).toStartWith('Mouvement introuvable.');
    expect(text).toContain('search_movements');
    expect(text.toLowerCase()).not.toContain('transaction');
  });

  it('points each unknown id to the tool that lists the valid ones', () => {
    expect(refusal(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, { id: ID })).toBe(
      'Modèle introuvable. Appelle list_templates pour les ids valides.',
    );
    expect(refusal(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND)).toContain(
      'get_template',
    );
    expect(refusal(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND)).toContain(
      'get_month',
    );
    expect(refusal(ERROR_DEFINITIONS.BUDGET_NOT_FOUND)).toContain(
      'list_months',
    );
    expect(refusal(ERROR_DEFINITIONS.TAG_NOT_FOUND, { id: ID })).toBe(
      'Tag introuvable. Appelle list_tags pour les ids valides.',
    );
  });

  it('keeps the details the agent needs in the French text', () => {
    expect(
      refusal(ERROR_DEFINITIONS.TAG_ALREADY_EXISTS, { name: 'Courses' }),
    ).toContain('Un tag « Courses » existe déjà');
    expect(
      refusal(ERROR_DEFINITIONS.TEMPLATE_IN_USE, {
        id: ID,
        months: '3/2027, 4/2027',
      }),
    ).toContain('(3/2027, 4/2027)');
  });

  it('relays a refusal a tool already worded for the agent', () => {
    const error = agentError(
      ERROR_DEFINITIONS.VALIDATION_FAILED,
      'Plage inversée.',
    );

    expect(error.getStatus()).toBe(400);
    expect(describeToolError(error)).toBe('Plage inversée.');
  });

  it('never rewords a tool refusal, even on a code it rewords elsewhere', () => {
    const error = agentError(
      ERROR_DEFINITIONS.TAG_NOT_FOUND,
      'Tag « Courses » supprimé entre-temps.',
    );

    expect(describeToolError(error)).toBe(
      'Tag « Courses » supprimé entre-temps.',
    );
  });

  it('hides any server failure behind a generic message', () => {
    expect(describeToolError(new Error('db exploded'))).toBe(
      'Pulpe n’a pas pu traiter cette demande.',
    );
    expect(
      describeToolError(
        new BusinessException(ERROR_DEFINITIONS.TAG_CREATE_FAILED),
      ),
    ).toBe('Pulpe n’a pas pu traiter cette demande.');
  });
});
