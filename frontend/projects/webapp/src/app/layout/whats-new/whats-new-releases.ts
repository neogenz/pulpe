export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.37.0',
  features: [
    'Lisser une dépense sur plusieurs mois',
    'Reporter une dépense au mois suivant',
  ],
};
