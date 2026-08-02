export const DEMO_RETENTION_HOURS = 24;

/**
 * The savings goals the demo shows, one per state the UI can render: a dated
 * plan, an open-ended plan, and a goal already reached.
 *
 * `envelopeName` is the prévision Épargne feeding the goal — a reached goal is
 * fed by nothing. `monthsUntilTarget` is null for an open-ended plan and
 * negative for a deadline already behind us. `priority` is deliberately absent:
 * the savings-goal module never writes it, so seeding it would show the
 * prospect a state the app itself cannot produce.
 *
 * A funded goal's deadline must reach past the last seeded month: the
 * `enforce_savings_goal_line_link` trigger rejects a prévision linked beyond it,
 * and a failed demo seed is swallowed into an empty demo rather than an error.
 */
export const DEMO_SAVINGS_GOAL_SPECS = [
  {
    name: 'Apport logement',
    targetAmount: 80000,
    initialAmount: 15000,
    status: 'ACTIVE',
    monthsUntilTarget: 18,
    envelopeName: 'Épargne logement',
  },
  {
    name: "Fonds d'urgence",
    targetAmount: 15000,
    initialAmount: 2000,
    status: 'ACTIVE',
    monthsUntilTarget: null,
    envelopeName: "Fonds d'urgence",
  },
  {
    name: 'Nouveau vélo',
    targetAmount: 1200,
    initialAmount: 1200,
    status: 'COMPLETED',
    monthsUntilTarget: -2,
    envelopeName: null,
  },
] as const;

/**
 * The one lissage the demo shows. The window straddles the current month so the
 * occurrence tracker has both a cumulated part and a non-zero rest to provision
 * — a window entirely in the past or the future would show neither.
 *
 * The total divides into 6 tranches with two remainder cents, which is exactly
 * what makes the cent-preserving split visible instead of a suspiciously round
 * division.
 */
export const DEMO_SPREAD_SPEC = {
  name: 'Prime assurance auto',
  totalAmount: 1085,
  monthCount: 6,
  firstMonthOffset: -2,
} as const;

export const DEMO_TEMPLATE_SPECS = {
  STANDARD: {
    name: '💰 Mois Standard',
    description:
      'Mon budget mensuel habituel avec toutes mes dépenses récurrentes',
    isDefault: true,
  },
  VACATIONS: {
    name: '✈️ Mois Vacances',
    description:
      'Budget spécial pour les mois avec voyages et sorties supplémentaires',
    isDefault: false,
  },
  SAVINGS: {
    name: '🎯 Mois Économies Renforcées',
    description: "Focus sur l'épargne avec réduction des dépenses variables",
    isDefault: false,
  },
  HOLIDAYS: {
    name: '🎄 Mois de Fêtes',
    description:
      'Budget adapté pour les périodes de fêtes avec cadeaux et repas',
    isDefault: false,
  },
} as const;
