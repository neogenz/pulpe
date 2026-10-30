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
  version: '0.58.0',
  features: {
    fr: ['Rapprocher tes comptes sur chaque mois', 'Montants plus lisibles'],
    en: ['Match your accounts in any month', 'Easier-to-read amounts'],
    de: ['Konten in jedem Monat abgleichen', 'Besser lesbare Beträge'],
    it: ['Allinea i conti in ogni mese', 'Importi più leggibili'],
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
    version: '0.57.0',
    reason:
      'Release iOS uniquement : adaptation à l’iPhone Duo, sans changement visible dans la webapp',
  },
  {
    version: '0.56.1',
    reason:
      'Réduction des traces internes Observe du serveur, sans changement visible dans la webapp',
  },
  {
    version: '0.54.1',
    reason:
      'Correction mineure de la disposition du formulaire d’ajout, publiée dans l’historique sans notification Nouveautés selon la décision de release',
  },
  {
    version: '0.52.0',
    reason:
      'Côté webapp, seulement des Réglages réorganisés et l’invitation à donner son avis : aucune nouvelle capacité qui justifie d’interrompre les utilisateurs existants',
  },
  {
    version: '0.51.1',
    reason:
      'Republication de l’app iOS 1.7.0 sous le build 2, la soumission de la 0.51.0 ayant échoué avant App Store Connect : aucun changement dans la webapp',
  },
  {
    version: '0.47.1',
    reason:
      'Republication de l’app iOS sous le build 11, la 0.47.0 n’ayant jamais atteint l’App Store : aucun changement dans la webapp',
  },
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
