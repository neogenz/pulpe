export const DEMO_RETENTION_HOURS = 24;

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
