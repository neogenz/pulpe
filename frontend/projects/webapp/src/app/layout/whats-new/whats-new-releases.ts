export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.31.0',
  features: [
    'Génération automatique de 12 mois de budgets',
    'Vérification de la clé de récupération',
    'Cache intelligent avec rafraîchissement en arrière-plan',
  ],
};
