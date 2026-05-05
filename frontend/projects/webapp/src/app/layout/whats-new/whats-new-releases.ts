export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.34.0',
  features: [
    'Multi-devise EUR/CHF avec conversion automatique',
    'Convertisseur de devises dans les Réglages',
    'Modèles de budget repensés et harmonisés',
    'Page d’accueil repensée avec transitions animées',
  ],
};
