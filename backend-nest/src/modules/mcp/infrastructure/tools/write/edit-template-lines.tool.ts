import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  budgetSchema,
  MAX_TAGS_PER_TRANSACTION,
  periodIndex,
  supportedCurrencySchema,
  transactionKindSchema,
  transactionRecurrenceSchema,
  type TemplateLinesBulkOperations,
} from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  BUDGET_TEMPLATE_WRITE_PORT,
  type BudgetTemplateWritePort,
} from '@modules/budget-template/domain/ports/budget-template-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { ResolveCurrencyUseCase } from '../../../application/resolve-currency.use-case';
import { askUser } from './elicitation';

// 50 per list keeps the total under the shared schema's 200-operation refine.
const MAX_ITEMS = 50;

const period = z.object({
  month: budgetSchema.shape.month.describe('Mois, 1 pour janvier'),
  year: budgetSchema.shape.year.describe('Année'),
});

const tagIds = z
  .array(z.uuid())
  .max(MAX_TAGS_PER_TRANSACTION)
  .optional()
  .describe('Tags de la prévision (ids, voir list_tags)');

const inputSchema = {
  templateId: z
    .uuid()
    .describe('Modèle à modifier. Les modèles sont dans list_templates'),
  scope: z
    .enum(['template_only', 'current_and_future', 'range'])
    .optional()
    .describe(
      'template_only = le modèle seul ; current_and_future = aussi le mois en cours et les suivants créés depuis ce modèle ; range = aussi les mois créés depuis ce modèle entre from et to. À demander à l’utilisateur, jamais à deviner',
    ),
  from: period
    .optional()
    .describe('Premier mois de la plage, avec scope range'),
  to: period.optional().describe('Dernier mois de la plage, avec scope range'),
  create: z
    .array(
      z.object({
        name: z.string().min(1).max(100).describe('Intitulé de la prévision'),
        amount: z
          .number()
          .positive()
          .describe('Montant tel que l’utilisateur l’a dit'),
        kind: transactionKindSchema.describe(
          'income = revenu, expense = dépense, saving = épargne',
        ),
        recurrence: transactionRecurrenceSchema
          .optional()
          .describe(
            'fixed = Mensuel, one_off = Ponctuel. À demander si non dit',
          ),
        currency: supportedCurrencySchema
          .optional()
          .describe(
            'Devise du montant, seulement si l’utilisateur en nomme une',
          ),
        tagIds,
      }),
    )
    .max(MAX_ITEMS)
    .optional()
    .describe('Prévisions à ajouter au modèle'),
  update: z
    .array(
      z.object({
        id: z.uuid().describe('Prévision du modèle, voir get_template'),
        name: z.string().min(1).max(100).optional().describe('Nouvel intitulé'),
        amount: z
          .number()
          .positive()
          .optional()
          .describe('Nouveau montant tel que l’utilisateur l’a dit'),
        kind: transactionKindSchema.optional().describe('Nouvelle nature'),
        recurrence: transactionRecurrenceSchema
          .optional()
          .describe('fixed = Mensuel, one_off = Ponctuel'),
        currency: supportedCurrencySchema
          .optional()
          .describe('Devise du nouveau montant, avec amount seulement'),
        tagIds: tagIds.describe(
          'Remplace tous les tags de la prévision (ids, voir list_tags)',
        ),
      }),
    )
    .max(MAX_ITEMS)
    .optional()
    .describe('Prévisions du modèle à modifier'),
  delete: z
    .array(z.uuid())
    .max(MAX_ITEMS)
    .optional()
    .describe('Prévisions du modèle à supprimer, voir get_template'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class EditTemplateLinesTool implements McpTool<Args> {
  readonly name = 'edit_template_lines';
  readonly title = 'Modifier les prévisions d’un modèle';
  readonly description =
    'Ajoute, modifie ou supprime des prévisions d’un modèle de mois. scope dit jusqu’où la modification s’applique : le modèle seul, le mois en cours et les suivants, ou une plage de mois, jamais avant le mois en cours. Les mois créés depuis ce modèle suivent, sauf les prévisions ajustées à la main dans un mois, qui restent telles quelles.';
  readonly mode = 'read_write' as const;
  // A repeated `create` adds the line twice: not idempotent.
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_TEMPLATE_WRITE_PORT)
    private readonly templates: BudgetTemplateWritePort,
    private readonly resolveCurrency: ResolveCurrencyUseCase,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const { templateId, scope, from, to } = args;
    const creates = args.create ?? [];
    const updates = args.update ?? [];
    const deletes = args.delete ?? [];

    if (creates.length + updates.length + deletes.length === 0) {
      return askUser(
        'ce qu’il faut ajouter, modifier ou supprimer dans ce modèle (get_template donne les identifiants des prévisions), puis rappelle edit_template_lines.',
      );
    }

    // The scope decides how many months change. Guessing it would rewrite
    // months the user never meant to touch.
    if (!scope) {
      return askUser(
        'si la modification vaut pour le modèle seul (template_only), aussi pour le mois en cours et les suivants (current_and_future), ou pour une plage de mois (range avec from et to), puis rappelle edit_template_lines avec scope.',
      );
    }
    if (scope === 'range' && (!from || !to)) {
      return askUser(
        'le premier et le dernier mois de la plage (from et to), puis rappelle edit_template_lines.',
      );
    }
    if (scope === 'range' && periodIndex(from!) > periodIndex(to!)) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: 'range from is after to',
      });
    }

    // Monthly or one-off changes what every month built from the template looks like.
    if (creates.some((line) => !line.recurrence)) {
      return askUser(
        'si chaque prévision à ajouter revient chaque mois (Mensuel) ou est ponctuelle (Ponctuel), puis rappelle edit_template_lines avec recurrence.',
      );
    }
    if (updates.some((line) => line.currency && line.amount === undefined)) {
      return askUser(
        'le montant dans cette devise : une devise seule ne change rien. Rappelle edit_template_lines avec amount et currency.',
      );
    }

    const ops: TemplateLinesBulkOperations = {
      create: await Promise.all(
        creates.map(async ({ currency, tagIds: tags, ...line }) => ({
          ...line,
          ...(await this.resolveCurrency.execute(line.amount, currency)),
          recurrence: line.recurrence!,
          description: '',
          ...(tags && { tagIds: [...new Set(tags)] }),
        })),
      ),
      update: await Promise.all(
        updates.map(async ({ currency, tagIds: tags, ...line }) => ({
          ...line,
          ...(line.amount === undefined
            ? {}
            : await this.resolveCurrency.execute(line.amount, currency)),
          ...(tags && { tagIds: [...new Set(tags)] }),
        })),
      ),
      delete: deletes,
      propagateToBudgets: scope !== 'template_only',
    };
    const result = await this.templates.editLines(
      templateId,
      ops,
      scope === 'range' ? { from: from!, to: to! } : undefined,
    );

    return {
      text: [
        `Modèle mis à jour : ${result.createdLines.length} prévisions ajoutées, ${result.updatedLines.length} modifiées, ${result.deletedIds.length} supprimées.`,
        ...result.createdLines.map((line) => `- [${line.id}] ${line.name}`),
        scope === 'template_only'
          ? 'Les mois déjà créés ne changent pas.'
          : `${result.propagation.affectedBudgetsCount} mois mis à jour. Les prévisions ajustées à la main dans un mois restent telles quelles.`,
      ].join('\n'),
    };
  }
}
