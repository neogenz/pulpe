export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export interface SkippedWhatsNewRelease {
  readonly version: string;
  readonly reason: string;
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.39.0',
  features: [
    'Une trajectoire plus lisible',
    'Une projection fidèle au plan',
    'Des simulations plus fiables',
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
  {
    version: '0.38.2',
    reason:
      'Release technique : le jour de paie voyage avec l’utilisateur authentifié, supprimant un appel réseau par budget matérialisé — rien de visible pour la webapp',
  },
];
