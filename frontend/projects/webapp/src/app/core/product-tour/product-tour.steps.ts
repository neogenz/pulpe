import { type TranslocoService } from '@jsverse/transloco';
import { type DriveStep } from 'driver.js';

export type TourPageId =
  | 'dashboard'
  | 'budget-list'
  | 'budget-details'
  | 'templates-list'
  | 'savings-goals';

export type TourId = 'intro' | TourPageId;

export function createProductTourSteps(
  transloco: TranslocoService,
): Record<TourId, DriveStep[]> {
  const text = (key: string) => transloco.translate(key);
  const intro: DriveStep[] = [
    {
      element: '[data-tour="dashboard-hero"]',
      popover: {
        title: text('productTour.intro.hero.title'),
        description: text('productTour.intro.hero.description'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dashboard-lists"]',
      popover: {
        title: text('productTour.intro.tracking.title'),
        description: text('productTour.intro.tracking.description'),
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="navigation"]',
      popover: {
        title: text('productTour.intro.navigation.title'),
        description: text('productTour.intro.navigation.description'),
        side: 'right',
        align: 'start',
      },
    },
  ];

  return {
    intro,
    dashboard: intro,
    'budget-list': [
      {
        element: '[data-tour="calendar-grid"]',
        popover: {
          title: text('productTour.budgetList.calendar.title'),
          description: text('productTour.budgetList.calendar.description'),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '[data-tour="create-budget"]',
        popover: {
          title: text('productTour.budgetList.create.title'),
          description: text('productTour.budgetList.create.description'),
          side: 'left',
          align: 'start',
        },
      },
    ],
    'budget-details': [
      {
        element: '[data-tour="financial-overview"]',
        popover: {
          title: text('productTour.budgetDetails.overview.title'),
          description: text('productTour.budgetDetails.overview.description'),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="budget-table"]',
        popover: {
          title: text('productTour.budgetDetails.tracking.title'),
          description: text('productTour.budgetDetails.tracking.description'),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '[data-testid="add-budget-line-fab"]',
        popover: {
          title: text('productTour.budgetDetails.create.title'),
          description: text('productTour.budgetDetails.create.description'),
          side: 'left',
          align: 'start',
        },
      },
    ],
    'templates-list': [
      {
        element: '[data-tour="templates-list"]',
        popover: {
          title: text('productTour.templatesList.list.title'),
          description: text('productTour.templatesList.list.description'),
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="create-template"]',
        popover: {
          title: text('productTour.templatesList.create.title'),
          description: text('productTour.templatesList.create.description'),
          side: 'left',
          align: 'start',
        },
      },
    ],
    'savings-goals': [
      {
        element: '[data-tour="savings-goals-list"]',
        popover: {
          title: text('productTour.savingsGoals.list.title'),
          description: text('productTour.savingsGoals.list.description'),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="create-goal"]',
        popover: {
          title: text('productTour.savingsGoals.create.title'),
          description: text('productTour.savingsGoals.create.description'),
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  };
}
