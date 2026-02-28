export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.28.0',
  features: [
    "Menu d'actions sur les transactions",
    'Section des transactions libres',
    'Limites du sélecteur de date corrigées',
  ],
};
