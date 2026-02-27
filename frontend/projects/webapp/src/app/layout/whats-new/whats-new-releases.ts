export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.26.0',
  features: [
    'Bloc de vérification du pointage budget',
    'Indicateurs de défilement sur les pilules',
    'Couleurs financières et mode sombre',
  ],
};
