export const ROUTES = {
  HOME: '',
  WELCOME: 'welcome',
  LOGIN: 'login',
  SIGNUP: 'signup',
  APP: 'app',
  CURRENT_MONTH: 'current-month',
  COMPLETE_PROFILE: 'complete-profile',
  BUDGET: 'budget',
  BUDGET_TEMPLATES: 'budget-templates',
  SETTINGS: 'settings',
  LEGAL: 'legal',

  // Legal paths
  LEGAL_TERMS: 'cgu',
  LEGAL_PRIVACY: 'confidentialite',
} as const;

// Titres de pages pour la TitleStrategy
export const PAGE_TITLES = {
  LOGIN: 'Connexion',
  SIGNUP: 'Créer un compte',
  DASHBOARD: 'Dashboard',
  CURRENT_MONTH: 'Mois en cours',
  COMPLETE_PROFILE: 'Finaliser mon profil',
  BUDGET: 'Mes budgets',
  BUDGET_TEMPLATES: 'Modèles de budget',
  WELCOME: 'Bienvenue',
  DASHBOARD_MONTH: 'Mois en cours',
  BUDGET_TEMPLATES_LIST: 'Mes modèles de budget',
  BUDGET_DETAILS: 'Détail du budget',
  NEW_TEMPLATE: 'Nouveau modèle',
  TEMPLATE_DETAIL: 'Détail du modèle',
  TEMPLATE_DETAIL_DYNAMIC: 'Modèle {{templateId}}',
  LEGAL: 'Mentions légales',
  LEGAL_TERMS: "Conditions Générales d'Utilisation",
  LEGAL_PRIVACY: 'Politique de Confidentialité',
  SETTINGS: 'Paramètres',
} as const;
