export const NAVIGATION_PATHS = {
  HOME: '',
  LOGIN: 'login',
  ONBOARDING: 'onboarding',
  APP: 'app',
  CURRENT_MONTH: '/app/current-month',
  OTHER_MONTHS: '/app/other-months',
  BUDGET_TEMPLATES: '/app/budget-templates',
  ONBOARDING_REGISTRATION: '/onboarding/registration',
  ONBOARDING_WELCOME: '/onboarding/welcome',
} as const;

export type NavigationPath =
  (typeof NAVIGATION_PATHS)[keyof typeof NAVIGATION_PATHS];

export interface NavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: string;
}

export interface NavigationSection {
  readonly title: string;
  readonly items: readonly NavigationItem[];
}

export type NavigationConfig = readonly NavigationSection[];

export const NAVIGATION_CONFIG: NavigationConfig = [
  {
    title: 'Budget',
    items: [
      {
        label: 'Mois en cours',
        route: NAVIGATION_PATHS.CURRENT_MONTH,
        icon: 'today',
      },
      {
        label: 'Autres mois',
        route: NAVIGATION_PATHS.OTHER_MONTHS,
        icon: 'calendar_month',
      },
      {
        label: 'Modèles de budget',
        route: NAVIGATION_PATHS.BUDGET_TEMPLATES,
        icon: 'description',
      },
    ],
  },
] as const;
