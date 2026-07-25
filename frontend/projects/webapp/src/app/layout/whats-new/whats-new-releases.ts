export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export interface SkippedWhatsNewRelease {
  readonly version: string;
  readonly reason: string;
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.38.0',
  features: [
    'Objectifs d’épargne avec plan mensuel',
    'Tags à la place des catégories libres',
    'Retrait d’épargne quand le mois est serré',
    'Connexion avec Apple',
  ],
};

export const SKIPPED_RELEASES: readonly SkippedWhatsNewRelease[] = [
  {
    version: '0.37.1',
    reason:
      'Omission historique acceptée après publication, sans rejouer le toast',
  },
  {
    version: '0.38.1',
    reason:
      'Correction serveur des prévisions d’épargne au-delà de l’échéance, un jour après le toast 0.38.0 : rien de neuf à annoncer',
  },
];
