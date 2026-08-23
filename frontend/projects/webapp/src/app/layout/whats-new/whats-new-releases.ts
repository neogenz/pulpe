import type { SupportedLocale } from 'pulpe-shared';

export interface WhatsNewRelease {
  readonly version: string;
  readonly features: Readonly<Record<SupportedLocale, readonly string[]>>;
}

export interface SkippedWhatsNewRelease {
  readonly version: string;
  readonly reason: string;
}

export const LATEST_RELEASE: WhatsNewRelease = {
  version: '0.45.0',
  features: {
    fr: [
      'Pulpe dans quatre langues',
      'Des montants exacts au centime',
      'Connexion et préférences plus fiables',
    ],
    en: [
      'Pulpe in four languages',
      'Amounts accurate to the cent',
      'More reliable sign-in and preferences',
    ],
    de: [
      'Pulpe in vier Sprachen',
      'Beträge auf den Rappen genau',
      'Zuverlässigere Anmeldung und Einstellungen',
    ],
    it: [
      'Pulpe in quattro lingue',
      'Importi precisi al centesimo',
      'Accesso e preferenze più affidabili',
    ],
  },
};

export function featuresForLocale(locale: string): readonly string[] {
  return (
    LATEST_RELEASE.features[locale as SupportedLocale] ??
    LATEST_RELEASE.features.fr
  );
}

export const SKIPPED_RELEASES: readonly SkippedWhatsNewRelease[] = [
  {
    version: '0.46.0',
    reason:
      'Aucun changement dans la webapp : la release concerne le site vitrine, l’app iOS et le processus de publication',
  },
  {
    version: '0.45.1',
    reason:
      'Hotfix exclusivement iOS pour la fluidité du scroll vertical de l’accueil, sans changement visible dans la webapp',
  },
  {
    version: '0.37.1',
    reason:
      'Omission historique acceptée après publication, sans rejouer le toast',
  },
  {
    version: '0.38.1',
    reason:
      'Correction serveur des prévisions d’épargne au-delà de l’échéance, un jour après le toast 0.38.0 : rien de neuf à annoncer',
  },
  {
    version: '0.38.2',
    reason:
      'Release technique : le jour de paie voyage avec l’utilisateur authentifié, supprimant un appel réseau par budget matérialisé — rien de visible pour la webapp',
  },
  {
    version: '0.41.0',
    reason:
      'Améliorations ciblées de l’inscription, de la projection initiale et des visites guidées, sans nouveauté assez importante pour interrompre les utilisateurs existants',
  },
  {
    version: '0.42.0',
    reason:
      'Durcissement du chiffrement, des sessions et des diagnostics sans changement visible dans la webapp : les seules corrections publiées concernent le site vitrine et iOS',
  },
  {
    version: '0.43.0',
    reason:
      'Aucun changement dans la webapp : la release ne touche que le site vitrine, l’app iOS et la résolution serveur de la version iOS publiée',
  },
];
