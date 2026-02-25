export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.25.0',
  features: [
    'Toast nouveautés à chaque version',
    "Seuil d'alerte budget unifié à 90%",
  ],
};
