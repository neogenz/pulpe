import { Inject, Injectable } from '@nestjs/common';
import {
  SAVINGS_GOAL_READ_PORT,
  type SavingsGoalReadPort,
} from '@modules/savings-goal/domain/ports/savings-goal-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { round } from './month-report';

const STATUS_LABEL = {
  ACTIVE: 'En cours',
  COMPLETED: 'Atteint',
  PAUSED: 'En pause',
} as const;

@Injectable()
export class ListSavingsGoalsTool implements McpTool {
  readonly name = 'list_savings_goals';
  readonly title = 'Objectifs d’épargne';
  readonly description =
    'Liste les objectifs d’épargne : intitulé, montant cible, échéance et état. Pour l’avancement chiffré d’un objectif, utiliser get_savings_goal_outlook.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = {};

  constructor(
    @Inject(SAVINGS_GOAL_READ_PORT)
    private readonly goals: SavingsGoalReadPort,
  ) {}

  async execute(): Promise<McpToolResult> {
    const goals = await this.goals.list();
    if (goals.length === 0) {
      return { text: 'Aucun objectif d’épargne.' };
    }
    return {
      text: [
        `Objectifs d’épargne (${goals.length})`,
        ...goals.map((g) => {
          const target =
            g.targetAmount == null
              ? 'sans cible'
              : `cible ${round(g.targetAmount)}`;
          const deadline = g.targetDate
            ? ` · échéance ${g.targetDate.slice(0, 10)}`
            : '';
          return `- [${g.id}] ${g.name} · ${target} · ${STATUS_LABEL[g.status]}${deadline}`;
        }),
      ].join('\n'),
    };
  }
}
