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
import {
  BUDGET_TEMPLATE_WRITE_PORT,
  type BudgetTemplateWritePort,
} from '@modules/budget-template/domain/ports/budget-template-write.port';
import { agentError } from '../../../domain/agent-error';
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
    'Ajoute, modifie ou supprime des prévisions d’un modèle de mois. Le modèle change toujours, donc aussi les mois créés plus tard depuis lui. scope dit quels mois existants suivent : aucun, le mois en cours et les suivants, ou une plage de mois, jamais avant le mois en cours. Les prévisions ajustées à la main dans un mois restent telles quelles. Pour changer seulement certains mois sans toucher au modèle, utiliser adjust_over_months. Si l’utilisateur n’a pas dit s’il veut changer le modèle ou seulement ces mois, lui demander avant d’appeler l’un ou l’autre. Une suppression (delete) n’est à envoyer qu’après confirmation explicite de l’utilisateur. Les tags d’une prévision du modèle se changent ici (update[].tagIds), pas avec tag_items.';
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
    const missing = this.#missingInput(args);
    if (missing) return missing;
    if (scope === 'range' && periodIndex(from!) > periodIndex(to!)) {
      throw agentError(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        'Plage inversée : from doit précéder to ou lui être égal. Rien n’a été modifié.',
      );
    }
    const updateIds = (args.update ?? []).map((line) => line.id);
    if (new Set(updateIds).size < updateIds.length) {
      throw agentError(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        'Une même prévision revient plusieurs fois dans update : regroupe ses changements en une seule entrée. Rien n’a été modifié.',
      );
    }

    const ops = await this.#operations(args);
    const result = await this.templates.editLines(
      templateId,
      ops,
      scope === 'range' ? { from: from!, to: to! } : undefined,
    );

    return {
      text: [
        `Modèle mis à jour. Prévisions ajoutées : ${result.createdLines.length}, modifiées : ${result.updatedLines.length}, supprimées : ${result.deletedIds.length}.`,
        ...result.createdLines.map((line) => `- [${line.id}] ${line.name}`),
        scope === 'template_only'
          ? 'Les mois déjà créés ne changent pas.'
          : `${result.propagation.affectedBudgetsCount} mois mis à jour. Les prévisions ajustées à la main dans un mois restent telles quelles.`,
      ].join('\n'),
    };
  }

  async #operations(args: Args): Promise<TemplateLinesBulkOperations> {
    return {
      create: await Promise.all(
        (args.create ?? []).map(
          async ({ currency, tagIds: tags, ...line }) => ({
            ...line,
            ...(await this.resolveCurrency.execute(line.amount, currency)),
            recurrence: line.recurrence!,
            description: '',
            ...(tags && { tagIds: [...new Set(tags)] }),
          }),
        ),
      ),
      update: await Promise.all(
        (args.update ?? []).map(
          async ({ currency, tagIds: tags, ...line }) => ({
            ...line,
            ...(line.amount === undefined
              ? {}
              : await this.resolveCurrency.execute(line.amount, currency)),
            ...(tags && { tagIds: [...new Set(tags)] }),
          }),
        ),
      ),
      delete: [...new Set(args.delete ?? [])],
      propagateToBudgets:
        args.scope === 'current_and_future' || args.scope === 'range',
    };
  }

  #missingInput({
    scope,
    from,
    to,
    create: creates = [],
    update: updates = [],
    delete: deletes = [],
  }: Args): McpToolResult | undefined {
    if (creates.length + updates.length + deletes.length === 0) {
      return askUser(
        'ce qu’il faut ajouter, modifier ou supprimer dans ce modèle (get_template donne les identifiants des prévisions), puis rappelle edit_template_lines.',
      );
    }
    // An update carrying only its id would still touch every propagated line and log an action.
    if (
      updates.some((line) =>
        Object.entries(line).every(
          ([key, value]) => key === 'id' || value === undefined,
        ),
      )
    ) {
      return askUser(
        'ce qu’il faut changer sur chaque prévision à modifier (intitulé, montant, nature, fréquence ou tags), puis rappelle edit_template_lines.',
      );
    }
    // The scope decides how many months change. Guessing it would rewrite
    // months the user never meant to touch.
    if (!scope) {
      return askUser(
        'si la modification vaut pour le modèle seul (template_only), pour le modèle et aussi le mois en cours et les suivants (current_and_future), ou pour le modèle et aussi les mois de from à to (range). Dans les trois cas le modèle change, donc aussi les mois créés plus tard depuis lui. Pour changer seulement certains mois sans toucher au modèle, utilise plutôt adjust_over_months. Sinon rappelle edit_template_lines avec scope.',
      );
    }
    if (scope === 'range' && (!from || !to)) {
      return askUser(
        'le premier et le dernier mois de la plage (from et to), puis rappelle edit_template_lines.',
      );
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
    return undefined;
  }
}
