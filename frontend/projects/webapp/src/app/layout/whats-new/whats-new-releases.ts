export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.34.1',
  features: ['Carte enveloppe mobile : "Disponible" + Dépensé / % restaurés'],
};
