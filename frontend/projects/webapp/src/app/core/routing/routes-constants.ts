export const ROUTES = {
  HOME: '',
  LOGIN: 'login',
  ONBOARDING: 'onboarding',
  APP: 'app',
  CURRENT_MONTH: 'current-month',
  BUDGET: 'budget',
  BUDGET_TEMPLATES: 'budget-templates',
  LEGAL: 'legal',

  // Onboarding step paths
  ONBOARDING_WELCOME: 'welcome',
  ONBOARDING_PERSONAL_INFO: 'personal-info',
  ONBOARDING_income: 'income',
  ONBOARDING_HOUSING: 'housing',
  ONBOARDING_HEALTH_INSURANCE: 'health-insurance',
  ONBOARDING_PHONE_PLAN: 'phone-plan',
  ONBOARDING_TRANSPORT: 'transport',
  ONBOARDING_LEASING_CREDIT: 'leasing-credit',
  ONBOARDING_REGISTRATION: 'registration',

  // Legal paths
  LEGAL_TERMS: 'cgu',
  LEGAL_PRIVACY: 'confidentialite',
} as const;

// Titres de pages pour la TitleStrategy
export const PAGE_TITLES = {
  LOGIN: 'Connexion',
  ONBOARDING: 'Configuration initiale',
  DASHBOARD: 'Dashboard',
  CURRENT_MONTH: 'Mois en cours',
  BUDGET: 'Mes budgets',
  BUDGET_TEMPLATES: 'Modèles de budget',
  WELCOME: 'Bienvenue',
  PERSONAL_INFO: 'Informations personnelles',
  HOUSING: 'Logement',
  income: 'Revenus',
  HEALTH_INSURANCE: 'Assurance maladie',
  PHONE_PLAN: 'Abonnement téléphonique',
  TRANSPORT: 'Transport',
  LEASING_CREDIT: 'Leasing et crédits',
  REGISTRATION: 'Création de compte',
  DASHBOARD_MONTH: 'Mois en cours',
  BUDGET_TEMPLATES_LIST: 'Mes modèles de budget',
  BUDGET_DETAILS: 'Détail du budget',
  NEW_TEMPLATE: 'Nouveau modèle',
  TEMPLATE_DETAIL: 'Détail du modèle',
  TEMPLATE_DETAIL_DYNAMIC: 'Modèle {{templateId}}',
  LEGAL: 'Mentions légales',
  LEGAL_TERMS: "Conditions Générales d'Utilisation",
  LEGAL_PRIVACY: 'Politique de Confidentialité',
} as const;
