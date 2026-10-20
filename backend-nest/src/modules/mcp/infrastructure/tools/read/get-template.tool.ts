import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BUDGET_TEMPLATE_READ_PORT,
  type BudgetTemplateReadPort,
} from '@modules/budget-template/domain/ports/budget-template-read.port';
import {
  TAG_READ_PORT,
  type TagReadPort,
} from '@modules/tag/domain/ports/tag-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { KIND_LABEL, round, tagNames, tagSuffix } from './month-report';

const inputSchema = {
  templateId: z
    .uuid()
    .describe('Modèle à lire. Les modèles sont dans list_templates'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class GetTemplateTool implements McpTool<Args> {
  readonly name = 'get_template';
  readonly title = 'Détail d’un modèle';
  readonly description =
    'Montre un modèle de mois : ses prévisions (nature, intitulé, montant, Mensuel ou Ponctuel, tags) et les mois créés depuis ce modèle. Les identifiants servent à edit_template_lines.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_TEMPLATE_READ_PORT)
    private readonly templates: BudgetTemplateReadPort,
    @Inject(TAG_READ_PORT)
    private readonly tags: TagReadPort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const [{ template, lines, months }, tags] = await Promise.all([
      this.templates.get(args.templateId),
      this.tags.list(),
    ]);
    const names = tagNames(tags);

    return {
      text: [
        `Modèle « ${template.name} » (id ${template.id})${template.isDefault ? ' · par défaut' : ''}${template.description ? ` · ${template.description}` : ''}`,
        '',
        `Prévisions (${lines.length})`,
        ...lines.map(
          (l) =>
            `- [${l.id}] ${KIND_LABEL[l.kind]} · ${l.name} · ${round(l.amount)} · ${l.recurrence === 'fixed' ? 'Mensuel' : 'Ponctuel'}${tagSuffix(l.tagIds, names)}`,
        ),
        '',
        months.length > 0
          ? `Mois créés depuis ce modèle (${months.length}) : ${months.map((m) => `${m.month}/${m.year}`).join(', ')}`
          : 'Aucun mois créé depuis ce modèle.',
      ].join('\n'),
    };
  }
}
