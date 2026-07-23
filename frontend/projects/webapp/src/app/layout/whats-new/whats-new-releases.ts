export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export interface SkippedWhatsNewRelease {
  readonly version: string;
  readonly reason: string;
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.37.0',
  features: [
    'Lisser une dépense sur plusieurs mois',
    'Reporter une dépense au mois suivant',
  ],
};

export const SKIPPED_RELEASES: readonly SkippedWhatsNewRelease[] = [
  {
    version: '0.37.1',
    reason:
      'Omission historique acceptée après publication, sans rejouer le toast',
  },
];
