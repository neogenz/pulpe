import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  SAVINGS_GOAL_READ_PORT,
  type SavingsGoalReadPort,
} from '@modules/savings-goal/domain/ports/savings-goal-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { round } from './month-report';

const PACE_LABEL = {
  behind: 'en retard',
  on_track: 'dans les temps',
  ahead: 'en avance',
} as const;

const inputSchema = {
  savingsGoalId: z.uuid().describe('Identifiant de l’objectif visé'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class GetSavingsGoalOutlookTool implements McpTool<Args> {
  readonly name = 'get_savings_goal_outlook';
  readonly title = 'Avancement d’un objectif d’épargne';
  readonly description =
    'Rend l’avancement d’un objectif : déjà mis de côté, projection, rythme, mois restants et date d’atteinte estimée. Les chiffres sont ceux de l’écran Objectifs, jamais recalculés.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(SAVINGS_GOAL_READ_PORT)
    private readonly goals: SavingsGoalReadPort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const { goal, computed } = await this.goals.outlook(args.savingsGoalId);
    const lines = [
      `Objectif « ${goal.name} » (id ${goal.id})`,
      `Cible ${goal.targetAmount == null ? 'non définie' : round(goal.targetAmount)}${goal.targetDate ? ` · échéance ${goal.targetDate.slice(0, 10)}` : ''}`,
      `Confirmé ${round(computed.confirmed)} · Prévu cumulé ${round(computed.plannedCumulative)} · Projection ${round(computed.plannedProjection)}`,
      `Rythme prévu ${round(computed.pace)} par mois · rythme confirmé ${round(computed.confirmedPace)} par mois`,
      `Mois écoulés ${computed.monthsElapsed} · mois restants ${computed.monthsRemaining ?? 'non projetables'}`,
    ];
    if (computed.achievementPercent != null) {
      lines.push(`Avancement ${round(computed.achievementPercent)} %`);
    }
    if (computed.paceStatus) {
      lines.push(`Situation : ${PACE_LABEL[computed.paceStatus]}`);
    }
    if (computed.isOverdue) {
      lines.push('Échéance dépassée.');
    }
    if (computed.estimatedCompletion) {
      lines.push(
        `Atteinte estimée au rythme confirmé : ${computed.estimatedCompletion.month}/${computed.estimatedCompletion.year}`,
      );
    }
    return { text: lines.join('\n') };
  }
}
