import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MAX_TAGS_PER_TRANSACTION } from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  BUDGET_LINE_WRITE_PORT,
  type BudgetLineWritePort,
} from '@modules/budget-line/domain/ports/budget-line-write.port';
import {
  TAG_READ_PORT,
  type TagReadPort,
} from '@modules/tag/domain/ports/tag-read.port';
import {
  TRANSACTION_WRITE_PORT,
  type TransactionWritePort,
} from '@modules/transaction/domain/ports/transaction-write.port';
import { agentError } from '../../../domain/agent-error';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { tagNames, tagSuffix } from '../read/month-report';
import { askUser } from './elicitation';

const MAX_ITEMS = 50;

const inputSchema = {
  items: z
    .array(
      z.object({
        target: z
          .enum(['movement', 'forecast'])
          .describe('movement = un mouvement réel, forecast = une prévision'),
        id: z.uuid().describe('Identifiant du mouvement ou de la prévision'),
      }),
    )
    .min(1)
    .max(MAX_ITEMS)
    .describe('Mouvements ou prévisions à taguer'),
  addTagIds: z
    .array(z.uuid())
    .max(MAX_TAGS_PER_TRANSACTION)
    .optional()
    .describe('Tags à poser (ids, voir list_tags)'),
  removeTagIds: z
    .array(z.uuid())
    .max(MAX_TAGS_PER_TRANSACTION)
    .optional()
    .describe('Tags à retirer (ids, voir list_tags)'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;
type Item = Args['items'][number];
interface Outcome {
  status: 'applied' | 'unchanged' | 'failed';
  row: string;
}

const ITEM_LABEL = { movement: 'Mouvement', forecast: 'Prévision' } as const;

@Injectable()
export class TagItemsTool implements McpTool<Args> {
  readonly name = 'tag_items';
  readonly title = 'Poser ou retirer des tags';
  readonly description =
    'Pose et/ou retire des tags sur 1 à 50 mouvements ou prévisions en un appel. Les tags non mentionnés restent en place ; un tag présent dans les deux listes est retiré. 10 tags au plus par élément : un élément qui dépasserait cette limite, ou introuvable, est signalé en échec sans bloquer les autres. Prévisions d’un mois seulement : pour celles d’un modèle, utiliser edit_template_lines (update[].tagIds). Taguer une prévision ne la marque pas comme ajustée : une mise à jour du modèle remplace ses tags.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TAG_READ_PORT)
    private readonly tags: TagReadPort,
    @Inject(TRANSACTION_WRITE_PORT)
    private readonly movements: TransactionWritePort,
    @Inject(BUDGET_LINE_WRITE_PORT)
    private readonly forecasts: BudgetLineWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const add = args.addTagIds ?? [];
    const remove = args.removeTagIds ?? [];
    if (add.length === 0 && remove.length === 0) {
      return askUser(
        'Quels tags poser ou retirer ? Appelle list_tags pour leurs ids, ou create_tag pour en créer un.',
      );
    }

    const names = tagNames(await this.tags.list());
    const unknown = [...new Set([...add, ...remove])].filter(
      (id) => !names.has(id),
    );
    if (unknown.length > 0) {
      throw agentError(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        `Tags inconnus : ${unknown.join(', ')}. Appelle list_tags ; rien n’a été modifié.`,
        { ids: unknown },
        { operation: 'mcp.tag_items' },
      );
    }

    const outcomes: Outcome[] = [];
    // ponytail: one update use case per item, so one budget recalculation each;
    // upgrade path: a tag-only write that skips the recalculation if 50-item
    // calls get slow.
    for (const item of args.items) {
      outcomes.push(await this.tagOne(item, add, remove, names));
    }
    const text = report(add, remove, names, outcomes);
    // An all-unchanged or all-failed call wrote nothing: keep it out of the activity log.
    return outcomes.some((o) => o.status === 'applied')
      ? { text }
      : { text, wrote: false };
  }

  private async tagOne(
    item: Item,
    add: readonly string[],
    remove: readonly string[],
    names: ReadonlyMap<string, string>,
  ): Promise<Outcome> {
    try {
      const current =
        item.target === 'movement'
          ? await this.movements.find(item.id)
          : await this.forecasts.find(item.id);
      const next = new Set(current.tagIds);
      add.forEach((id) => next.add(id));
      remove.forEach((id) => next.delete(id));

      const label = `${line(item)} « ${current.name} »`;
      if (
        next.size === current.tagIds.length &&
        current.tagIds.every((id) => next.has(id))
      ) {
        return { status: 'unchanged', row: label };
      }
      if (next.size > MAX_TAGS_PER_TRANSACTION) {
        return {
          status: 'failed',
          row: `${line(item)} : dépasserait ${MAX_TAGS_PER_TRANSACTION} tags`,
        };
      }
      const tagIds = [...next];
      await (item.target === 'movement'
        ? this.movements.update(item.id, { tagIds })
        : this.forecasts.update(item.id, { id: item.id, tagIds }));
      return { status: 'applied', row: `${label}${tagSuffix(tagIds, names)}` };
    } catch (error) {
      // Add/remove converges, so re-running the call after an abort is safe.
      if (!(error instanceof BusinessException) || error.getStatus() >= 500) {
        throw error;
      }
      return {
        status: 'failed',
        row: `${line(item)} : ${error.getStatus() === 404 ? 'introuvable' : error.message}`,
      };
    }
  }
}

function report(
  add: readonly string[],
  remove: readonly string[],
  names: ReadonlyMap<string, string>,
  outcomes: readonly Outcome[],
): string {
  const posed = add.filter((id) => !remove.includes(id));
  const section = (title: string, status: Outcome['status']): string => {
    const rows = outcomes.filter((o) => o.status === status).map((o) => o.row);
    return rows.length > 0
      ? [`${title} (${rows.length})`, ...rows].join('\n')
      : '';
  };
  // The request alone would read as done when every item failed or was unchanged.
  const summary = outcomes.some((o) => o.status === 'applied')
    ? [
        posed.length > 0 && `Tags posés : ${nameList(posed, names)}`,
        remove.length > 0 && `Tags retirés : ${nameList(remove, names)}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Rien n’a été modifié.';
  return [
    summary,
    section('Appliqués', 'applied'),
    section('Inchangés', 'unchanged'),
    section('En échec', 'failed'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

const line = (item: Item): string =>
  `- [${item.id}] ${ITEM_LABEL[item.target]}`;

const nameList = (
  ids: readonly string[],
  names: ReadonlyMap<string, string>,
): string => ids.flatMap((id) => names.get(id) ?? []).join(', ');
