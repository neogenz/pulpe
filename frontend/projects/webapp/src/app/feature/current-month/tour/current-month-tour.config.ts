import { type TourStep } from '@core/tour';

/**
 * Tour steps for the Current Month page
 * Introduces users to the monthly budget dashboard
 */
export const CURRENT_MONTH_TOUR_STEPS: TourStep[] = [
  {
    element: 'pulpe-budget-progress-bar',
    title: 'Votre budget du mois',
    description:
      'Visualisez vos dépenses par rapport à votre budget disponible. La barre de progression montre votre consommation.',
    side: 'bottom',
  },
  {
    element: '[data-testid="recurring-expenses-list"]',
    title: 'Dépenses fixes',
    description:
      'Vos charges régulières (loyer, assurances, abonnements) apparaissent ici. Elles sont importées de votre modèle.',
    side: 'top',
  },
  {
    element: '[data-testid="one-time-expenses-list"]',
    title: 'Dépenses du mois',
    description:
      'Ajoutez vos dépenses ponctuelles : courses, restaurants, sorties... Tout ce qui varie chaque mois.',
    side: 'top',
  },
  {
    element: '[data-testid="add-transaction-fab"]',
    title: 'Ajouter une dépense',
    description:
      "Appuyez sur ce bouton pour enregistrer une nouvelle dépense. C'est rapide et simple !",
    side: 'left',
  },
];
