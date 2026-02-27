export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.27.0',
  features: [
    'Libelles du pointage clarifies',
    'Stabilite du mot de passe oublie',
    'Corrections de securite',
  ],
};
