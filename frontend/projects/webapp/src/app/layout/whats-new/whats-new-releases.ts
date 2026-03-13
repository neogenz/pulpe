export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.30.0',
  features: [
    'Changement de code PIN depuis les réglages',
    'Toggle "Pointé" par défaut à la création',
    'Correction de la formule de projection',
  ],
};
