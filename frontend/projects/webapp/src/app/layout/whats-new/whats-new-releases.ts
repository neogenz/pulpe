export interface WhatsNewRelease {
  readonly version: string;
  readonly features: readonly string[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.36.0',
  features: ['Affichage adapté à ta devise (CH/FR)'],
};
