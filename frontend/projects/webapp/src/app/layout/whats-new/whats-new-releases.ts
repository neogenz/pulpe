export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.29.0',
  features: [
    'Etats de consommation colores sur les previsions',
    'Correction de la logique enveloppe',
    'Protection des montants dans les captures',
  ],
};
