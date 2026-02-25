export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.24.0',
  features: [
    'Tableau de bord repensé avec actions rapides',
    'Blocs épargne et aperçu du mois suivant',
  ],
};
