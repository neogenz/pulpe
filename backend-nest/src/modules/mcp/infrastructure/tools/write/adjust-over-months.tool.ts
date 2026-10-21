import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  budgetSchema,
  periodIndex,
  supportedCurrencySchema,
  type BudgetPeriod,
} from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { agentError } from '../../../domain/agent-error';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import {
  AdjustOverMonthsUseCase,
  type AdjustOverMonthsResult,
} from '../../../application/adjust-over-months.use-case';
import { round } from '../read/month-report';
import { askUser } from './elicitation';

const MAX_MONTHS = 12;

const period = z.object({
  month: budgetSchema.shape.month.describe('Mois, 1 pour janvier'),
  year: budgetSchema.shape.year.describe('Année'),
});

const inputSchema = {
  target: z
    .enum(['forecast', 'movement'])
    .describe(
      'forecast = une prévision, movement = un mouvement rattaché à une prévision',
    ),
  id: z
    .uuid()
    .describe(
      'Identifiant de la prévision ou du mouvement dans le mois de départ, lu avec get_month',
    ),
  month: period.shape.month.describe('Mois de départ, celui de id'),
  year: period.shape.year.describe('Année du mois de départ'),
  name: z.string().min(1).max(100).optional().describe('Nouvel intitulé'),
  amount: z
    .number()
    .positive()
    .optional()
    .describe('Nouveau montant tel que l’utilisateur l’a dit'),
  currency: supportedCurrencySchema
    .optional()
    .describe(
      'Devise du nouveau montant, seulement si l’utilisateur en nomme une',
    ),
  months: z
    .number()
    .int()
    .min(1)
    .max(MAX_MONTHS)
    .optional()
    .describe('Nombre de mois, mois de départ compris'),
  until: period.optional().describe('Dernier mois à ajuster, compris'),
  chosenIds: z
    .array(z.uuid())
    .max(MAX_MONTHS)
    .optional()
    .describe(
      'Réponse de l’utilisateur quand plusieurs éléments correspondent dans un mois : un seul identifiant par mois',
    ),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

const label = ({ month, year }: BudgetPeriod): string => `${month}/${year}`;
const labels = (periods: BudgetPeriod[]): string =>
  periods.map(label).join(', ');

@Injectable()
export class AdjustOverMonthsTool implements McpTool<Args> {
  readonly name = 'adjust_over_months';
  readonly title = 'Ajuster sur plusieurs mois';
  readonly description =
    'Applique le même changement d’intitulé ou de montant à une prévision, ou à un mouvement rattaché à une prévision, sur plusieurs mois consécutifs (12 au plus) à partir du mois donné, sans toucher au modèle. Pour changer aussi le modèle, utiliser edit_template_lines. Si l’utilisateur n’a pas dit s’il veut changer le modèle ou seulement ces mois, lui demander avant d’appeler l’un ou l’autre. Dans chaque mois, l’équivalent est la prévision issue de la même prévision du modèle, sinon celle de même intitulé et de même nature. Un mois sans budget n’est jamais créé : la réponse le liste. Les prévisions modifiées sont marquées ajustées à la main : une modification du modèle ne les changera plus.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(private readonly adjust: AdjustOverMonthsUseCase) {}

  async execute(args: Args): Promise<McpToolResult> {
    const question = this.#missingInput(args);
    if (question) return question;

    const { target, id, month, year, name, amount, currency, chosenIds } = args;
    const from = { month, year };
    const count = args.until
      ? periodIndex(args.until) - periodIndex(from) + 1
      : args.months!;
    if (count < 1 || count > MAX_MONTHS) {
      throw agentError(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        `until doit tomber entre le mois de départ et ${MAX_MONTHS} mois plus tard, mois de départ compris. Rien n’a été modifié.`,
      );
    }

    const result = await this.adjust.execute({
      target,
      id,
      from,
      count,
      name,
      amount,
      currency,
      chosenIds,
    });
    return result.status === 'ambiguous'
      ? this.#askWhich(result)
      : this.#report(target, result);
  }

  #missingInput({
    name,
    amount,
    currency,
    months,
    until,
  }: Args): McpToolResult | undefined {
    if (currency !== undefined && amount === undefined) {
      return askUser(
        'le montant dans cette devise : une devise seule ne change rien. Rappelle adjust_over_months avec amount et currency.',
      );
    }
    if (name === undefined && amount === undefined) {
      return askUser(
        'ce qu’il faut changer (le nouvel intitulé ou le nouveau montant), puis rappelle adjust_over_months.',
      );
    }
    if ((months === undefined) === (until === undefined)) {
      return askUser(
        'sur combien de mois, ou jusqu’à quel mois, puis rappelle adjust_over_months avec months ou until (pas les deux).',
      );
    }
    return undefined;
  }

  #askWhich(
    result: Extract<AdjustOverMonthsResult, { status: 'ambiguous' }>,
  ): McpToolResult {
    const lines = result.months.map(
      ({ period: p, candidates }) =>
        `${label(p)} : ${candidates
          .map((c) => `[${c.id}] ${c.name} · ${round(c.amount)}`)
          .join(' ; ')}`,
    );
    return askUser(
      `plusieurs éléments correspondent. ${lines.join(' ; ')}. Demande lequel ajuster dans chaque mois (un seul par mois), puis rappelle adjust_over_months avec les mêmes arguments et chosenIds.`,
    );
  }

  #report(
    target: Args['target'],
    {
      updated,
      missingMonths,
      unmatched,
      failed,
    }: Extract<AdjustOverMonthsResult, { status: 'done' }>,
  ): McpToolResult {
    const text = [
      updated.length > 0
        ? `Ajusté sur ${updated.length} mois : ${labels(updated)}.`
        : 'Aucun mois ajusté.',
      missingMonths.length > 0 &&
        `Mois sans budget, non créés : ${labels(missingMonths)}.`,
      unmatched.length > 0 && `Mois sans équivalent : ${labels(unmatched)}.`,
      failed.length > 0 &&
        `Mois refusés : ${failed.map((f) => `${label(f.period)} (${f.reason})`).join(', ')}.`,
      updated.length > 0 &&
        target === 'forecast' &&
        'Ces prévisions sont désormais ajustées à la main : une modification du modèle ne les changera plus.',
    ]
      .filter(Boolean)
      .join('\n');

    // Nothing written (no month matched, or every write refused): keep it out of the activity log.
    return updated.length > 0 ? { text } : { text, wrote: false };
  }
}
