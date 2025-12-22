import { type TourStep } from '@core/tour';

/**
 * Tour steps for the Budget List page
 * Introduces users to the year-by-year budget planning
 */
export const BUDGET_TOUR_STEPS: TourStep[] = [
  {
    element: 'mat-tab-group, pulpe-year-calendar',
    title: "Calendrier de l'année",
    description:
      'Chaque mois représente un budget. Les mois colorés sont créés, les gris sont à planifier.',
    side: 'bottom',
  },
  {
    element: '[data-testid="create-budget-btn"]',
    title: 'Créer un budget',
    description:
      'Sélectionnez un mois et un modèle pour créer votre budget. Le report du mois précédent est calculé automatiquement.',
    side: 'bottom',
  },
];
