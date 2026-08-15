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
  version: '0.44.0',
  features: {
    fr: [
      'Ajoute l’argent d’un objectif comme revenu ce mois ou plus tard',
      'Vois ce qui est déjà passé sur ton compte et ce qu’il te reste pour le mois',
      'Annule aussitôt ce que tu viens de pointer ou de noter',
      'Ajoute aux budgets déjà créés les versements prévus pour ton objectif',
    ],
    en: [
      'Add money from a goal as income now or later',
      'See what has already cleared and what remains for the month',
      'Immediately undo the item you just checked off or added',
      'Add planned goal contributions to budgets already created',
    ],
    de: [
      'Füge Geld aus einem Ziel jetzt oder später als Einnahme hinzu',
      'Sieh, was bereits vom Konto abgegangen ist und was für den Monat bleibt',
      'Mache einen gerade abgehakten oder erfassten Eintrag sofort rückgängig',
      'Ergänze geplante Zielbeiträge in bereits erstellten Budgets',
    ],
    it: [
      'Aggiungi il denaro di un obiettivo come entrata, ora o più avanti',
      'Vedi ciò che è già passato sul conto e quanto resta per il mese',
      'Annulla subito una voce appena spuntata o aggiunta',
      'Aggiungi i versamenti previsti per un obiettivo ai budget già creati',
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
