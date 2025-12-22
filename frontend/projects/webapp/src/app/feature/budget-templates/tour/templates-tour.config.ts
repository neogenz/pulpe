import { type TourStep } from '@core/tour';

/**
 * Tour steps for the Budget Templates page
 * Introduces users to reusable budget templates
 */
export const TEMPLATES_TOUR_STEPS: TourStep[] = [
  {
    element:
      '[data-testid="templates-list"], [data-testid="templates-loading"]',
    title: 'Vos modèles de budget',
    description:
      'Les modèles définissent la structure de vos mois : revenus, charges fixes, catégories. Créez-en un pour commencer !',
    side: 'bottom',
  },
  {
    element: '[data-testid="create-template-button"]',
    title: 'Créer un modèle',
    description:
      'Un modèle vous permet de planifier vos mois une seule fois, puis de le réutiliser. Gagnez du temps !',
    side: 'bottom',
  },
  {
    element: '[data-testid="template-counter"]',
    title: 'Limite de modèles',
    description:
      "Vous pouvez créer jusqu'à 5 modèles. Un seul suffit généralement pour la plupart des situations.",
    side: 'bottom',
  },
];
