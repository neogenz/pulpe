export const ROUTES = {
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

// Titres de pages pour la TitleStrategy
export const PAGE_TITLES = {
  LOGIN: 'Connexion',
  ONBOARDING: 'Configuration initiale',
  DASHBOARD: 'Dashboard',
  CURRENT_MONTH: 'Mois en cours',
  OTHER_MONTHS: 'Autres mois',
  BUDGET_TEMPLATES: 'Modèles de budget',
  WELCOME: 'Bienvenue',
  PERSONAL_INFO: 'Informations personnelles',
  HOUSING: 'Logement',
  INCOME: 'Revenus',
  HEALTH_INSURANCE: 'Assurance maladie',
  PHONE_PLAN: 'Abonnement téléphonique',
  TRANSPORT: 'Transport',
  LEASING_CREDIT: 'Leasing et crédits',
  REGISTRATION: 'Création de compte',
  DASHBOARD_MONTH: 'Mois en cours',
  BUDGET_TEMPLATES_LIST: 'Mes modèles de budget',
  NEW_TEMPLATE: 'Nouveau modèle',
  TEMPLATE_DETAIL: 'Détail du modèle',
  TEMPLATE_DETAIL_DYNAMIC: 'Modèle {{templateId}}',
} as const;
