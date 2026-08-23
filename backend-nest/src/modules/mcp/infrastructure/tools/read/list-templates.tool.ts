import { Inject, Injectable } from '@nestjs/common';
import {
  BUDGET_TEMPLATE_READ_PORT,
  type BudgetTemplateReadPort,
} from '@modules/budget-template/domain/ports/budget-template-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

@Injectable()
export class ListTemplatesTool implements McpTool {
  readonly name = 'list_templates';
  readonly title = 'Modèles de mois';
  readonly description =
    'Liste les modèles de mois de l’utilisateur, en signalant celui par défaut. Sert à choisir le modèle avec lequel créer le budget d’un mois.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = {};

  constructor(
    @Inject(BUDGET_TEMPLATE_READ_PORT)
    private readonly templates: BudgetTemplateReadPort,
  ) {}

  async execute(): Promise<McpToolResult> {
    const templates = await this.templates.list();
    if (templates.length === 0) {
      return { text: 'Aucun modèle de mois.' };
    }
    return {
      text: [
        `Modèles de mois (${templates.length})`,
        ...templates.map(
          (t) =>
            `- [${t.id}] ${t.name}${t.isDefault ? ' · par défaut' : ''}${t.description ? ` · ${t.description}` : ''}`,
        ),
      ].join('\n'),
    };
  }
}
