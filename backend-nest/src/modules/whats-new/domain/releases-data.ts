import type { SupportedLocale } from 'pulpe-shared';

export interface WhatsNewReleaseChangeItem {
  title: string;
  description: string;
}

export type WhatsNewTranslatedLocale = Exclude<SupportedLocale, 'fr'>;

export interface WhatsNewLocalizedChanges {
  features: WhatsNewReleaseChangeItem[];
  fixes: WhatsNewReleaseChangeItem[];
}

export interface WhatsNewReleaseEntry {
  version: string;
  /**
   * iOS marketing version that shipped this projection, absent on a release
   * that never reached the App Store. An iOS release intentionally without a
   * dialog is recorded in `SILENT_IOS_RELEASES` instead of being omitted
   * implicitly or represented by an incomplete projection; that ledger covers
   * iOS alone, which is why this field and not `version` may be missing.
   *
   * Android reads `version` directly (`clientVersionOf`), so an Android-only
   * release is a complete entry with no iOS marketing version at all.
   */
  iosVersion?: string;
  date: string;
  platforms: ('android' | 'ios' | 'web')[];
  changes: {
    features: WhatsNewReleaseChangeItem[];
    fixes: WhatsNewReleaseChangeItem[];
    technical: WhatsNewReleaseChangeItem[];
  };
  translations?: Partial<
    Record<WhatsNewTranslatedLocale, WhatsNewLocalizedChanges>
  >;
}

export interface SilentIosReleaseEntry {
  readonly version: string;
  readonly reason: string;
}

/**
 * Checked-in mobile projections of `landing/data/releases.json` (maintained by the
 * `/release` skill). The deployed backend artifact does not contain
 * the `landing/` package, so the data lives here as a TypeScript literal rather
 * than being read from disk at runtime. Keep release metadata in sync and this
 * list ordered newest-first. Each entry targets only the platforms its notes
 * apply to; one product release may have disjoint iOS and Android projections.
 * Only iOS projections carry an App Store marketing version. `githubUrl` and
 * technical changes are dropped.
 */
export const RELEASES: WhatsNewReleaseEntry[] = [
  {
    version: '0.56.0',
    iosVersion: '1.11.0',
    date: '2026-10-25',
    platforms: ['ios'],
    changes: {
      features: [
        {
          title: 'Supprimer un mois à venir',
          description:
            'Depuis le détail d’un mois futur, tu peux supprimer son budget ; la confirmation indique ce qui part et les liens avec tes objectifs.',
        },
      ],
      fixes: [
        {
          title: 'Mouvements rattachés',
          description:
            'Quand tu changes la nature d’une prévision, ses mouvements la suivent et restent comptés dans tes totaux.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Delete an upcoming month',
            description:
              'From a future month’s details, you can delete its budget; the confirmation shows what goes and any links to your savings goals.',
          },
        ],
        fixes: [
          {
            title: 'Linked entries',
            description:
              'When you change a forecast’s type, its entries follow it and stay counted in your totals.',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Kommenden Monat löschen',
            description:
              'In den Details eines künftigen Monats kannst du sein Budget löschen; die Bestätigung zeigt, was wegfällt und welche Verknüpfungen zu deinen Sparzielen bestehen.',
          },
        ],
        fixes: [
          {
            title: 'Verknüpfte Bewegungen',
            description:
              'Wenn du die Art eines Planungseintrags änderst, folgen ihm seine Bewegungen und zählen weiter in deinen Summen.',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Eliminare un mese futuro',
            description:
              'Dal dettaglio di un mese futuro puoi eliminarne il budget; la conferma indica cosa viene rimosso e gli eventuali legami con i tuoi obiettivi di risparmio.',
          },
        ],
        fixes: [
          {
            title: 'Movimenti collegati',
            description:
              'Quando cambi la natura di una previsione, i suoi movimenti la seguono e restano conteggiati nei totali.',
          },
        ],
      },
    },
  },
  {
    version: '0.56.0',
    date: '2026-10-25',
    platforms: ['android'],
    changes: {
      features: [
        {
          title: 'Supprimer un mois à venir',
          description:
            'Depuis le détail d’un mois futur, tu peux supprimer son budget ; la confirmation indique ce qui part et les liens avec tes objectifs.',
        },
      ],
      fixes: [
        {
          title: 'Mouvements rattachés',
          description:
            'Quand tu changes la nature d’une prévision, ses mouvements la suivent et restent comptés dans tes totaux.',
        },
        {
          title: 'Confirmation du code',
          description:
            'Sur Android, une erreur de confirmation conserve le code choisi et te permet de réessayer sans tout recommencer.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Delete an upcoming month',
            description:
              'From a future month’s details, you can delete its budget; the confirmation shows what goes and any links to your savings goals.',
          },
        ],
        fixes: [
          {
            title: 'Linked entries',
            description:
              'When you change a forecast’s type, its entries follow it and stay counted in your totals.',
          },
          {
            title: 'Code confirmation',
            description:
              'On Android, a confirmation mismatch preserves your chosen code so you can retry without starting over.',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Kommenden Monat löschen',
            description:
              'In den Details eines künftigen Monats kannst du sein Budget löschen; die Bestätigung zeigt, was wegfällt und welche Verknüpfungen zu deinen Sparzielen bestehen.',
          },
        ],
        fixes: [
          {
            title: 'Verknüpfte Bewegungen',
            description:
              'Wenn du die Art eines Planungseintrags änderst, folgen ihm seine Bewegungen und zählen weiter in deinen Summen.',
          },
          {
            title: 'Code bestätigen',
            description:
              'Unter Android bleibt dein gewählter Code bei einer falschen Bestätigung erhalten, damit du es erneut versuchen kannst, ohne von vorne anzufangen.',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Eliminare un mese futuro',
            description:
              'Dal dettaglio di un mese futuro puoi eliminarne il budget; la conferma indica cosa viene rimosso e gli eventuali legami con i tuoi obiettivi di risparmio.',
          },
        ],
        fixes: [
          {
            title: 'Movimenti collegati',
            description:
              'Quando cambi la natura di una previsione, i suoi movimenti la seguono e restano conteggiati nei totali.',
          },
          {
            title: 'Conferma del codice',
            description:
              'Su Android, un errore di conferma conserva il codice scelto e ti permette di riprovare senza ricominciare da capo.',
          },
        ],
      },
    },
  },
  {
    version: '0.54.0',
    iosVersion: '1.10.0',
    date: '2026-10-20',
    platforms: ['ios'],
    changes: {
      features: [
        {
          title: '« Cet argent vient de mon épargne »',
          description:
            'Sur un revenu, active cet interrupteur pour dire d’où vient l’argent : un retrait sur un objectif, ou une avance sur ton épargne que tu remettras le mois suivant.',
        },
      ],
      fixes: [],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: '“This money comes from my savings”',
            description:
              'On an income, turn on this switch to say where the money comes from: a withdrawal from a goal, or an advance on your savings that you’ll put back the following month.',
          },
        ],
        fixes: [],
      },
      de: {
        features: [
          {
            title: '«Dieses Geld kommt aus meinem Ersparten»',
            description:
              'Bei einer Einnahme zeigt dieser Schalter, woher das Geld kommt: eine Entnahme aus einem Ziel oder ein Vorschuss aus deinem Ersparten, den du im Folgemonat zurücklegst.',
          },
        ],
        fixes: [],
      },
      it: {
        features: [
          {
            title: '«Questi soldi vengono dai miei risparmi»',
            description:
              'Su un’entrata, attiva questo interruttore per indicare da dove arrivano i soldi: un prelievo da un obiettivo o un anticipo sui tuoi risparmi da rimettere il mese successivo.',
          },
        ],
        fixes: [],
      },
    },
  },
  {
    version: '0.53.0',
    iosVersion: '1.9.0',
    date: '2026-10-16',
    platforms: ['ios'],
    changes: {
      features: [
        {
          title: 'Pointer un retrait d’objectif en un clic',
          description:
            'Sur un revenu prévu depuis un objectif, active « Pointé » : le revenu est créé pour le montant restant, déjà pointé. Désactive-le pour l’annuler, l’argent retourne sur l’objectif.',
        },
      ],
      fixes: [],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Check a goal withdrawal in one click',
            description:
              'On an income planned from a goal, turn on “Checked”: the income is created for the remaining amount, already checked. Turn it off to cancel it; the money goes back to the goal.',
          },
        ],
        fixes: [],
      },
      de: {
        features: [
          {
            title: 'Zielentnahme mit einem Klick abhaken',
            description:
              'Bei einer aus einem Ziel geplanten Einnahme «Abgehakt» einschalten: Die Einnahme wird für den Restbetrag erfasst, bereits abgehakt. Ausschalten macht sie rückgängig, das Geld geht zurück ins Ziel.',
          },
        ],
        fixes: [],
      },
      it: {
        features: [
          {
            title: 'Spunta un prelievo da un obiettivo con un clic',
            description:
              'Su un’entrata pianificata da un obiettivo, attiva «Spuntato»: l’entrata viene registrata per l’importo restante, già spuntata. Disattivala per annullarla; il denaro torna sull’obiettivo.',
          },
        ],
        fixes: [],
      },
    },
  },
  {
    version: '0.52.0',
    iosVersion: '1.8.0',
    date: '2026-10-13',
    platforms: ['ios'],
    changes: {
      features: [
        {
          title: 'Récap du lundi',
          description:
            'Chaque lundi matin, une notification te dit combien tu peux dépenser cette semaine et quelles prévisions t’attendent. À activer dans Préférences.',
        },
      ],
      fixes: [],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Monday recap',
            description:
              'Every Monday morning, a notification tells you how much you can spend this week and which planned items are coming up. Turn it on in Preferences.',
          },
        ],
        fixes: [],
      },
      de: {
        features: [
          {
            title: 'Montags-Rückblick',
            description:
              'Jeden Montagmorgen zeigt dir eine Mitteilung, wie viel du diese Woche ausgeben kannst und welche Planposten anstehen. In den Einstellungen aktivierbar.',
          },
        ],
        fixes: [],
      },
      it: {
        features: [
          {
            title: 'Riepilogo del lunedì',
            description:
              'Ogni lunedì mattina, una notifica ti dice quanto puoi spendere questa settimana e quali previsioni ti aspettano. Da attivare nelle Preferenze.',
          },
        ],
        fixes: [],
      },
    },
  },
  {
    version: '0.51.0',
    iosVersion: '1.7.0',
    date: '2026-10-11',
    platforms: ['ios'],
    changes: {
      features: [
        {
          title: 'Rapprocher mes comptes',
          description:
            'Compare le solde de tes comptes à ton solde pointé et ajuste l’écart en un geste.',
        },
        {
          title: 'Bilan du mois',
          description:
            'À l’ouverture d’un nouveau mois, un bilan résume le mois terminé et le montant reporté.',
        },
        {
          title: 'Pointage priorisé',
          description:
            'L’accueil propose d’abord les prévisions que tu pointes d’habitude à cette période du mois.',
        },
      ],
      fixes: [
        {
          title: 'Barre de navigation',
          description:
            'Le titre et les boutons restent lisibles quand tu fais défiler l’accueil, les budgets ou un objectif.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Match my accounts',
            description:
              'Compare your account balances with your checked balance and adjust the difference in one step.',
          },
          {
            title: 'Month recap',
            description:
              'When a new month starts, a recap sums up the month that ended and the amount carried over.',
          },
          {
            title: 'Smarter checking',
            description:
              'The home screen first shows the planned items you usually check at this point of the month.',
          },
        ],
        fixes: [
          {
            title: 'Navigation bar',
            description:
              'The title and buttons stay readable when you scroll the home screen, budgets or a goal.',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Konten abgleichen',
            description:
              'Vergleiche deine Kontostände mit deinem abgehakten Saldo und gleiche die Differenz in einem Schritt aus.',
          },
          {
            title: 'Monatsrückblick',
            description:
              'Beginnt ein neuer Monat, fasst ein Rückblick den abgelaufenen Monat und den übertragenen Betrag zusammen.',
          },
          {
            title: 'Priorisiertes Abhaken',
            description:
              'Die Startseite zeigt zuerst die Planposten, die du zu diesem Zeitpunkt im Monat üblicherweise abhakst.',
          },
        ],
        fixes: [
          {
            title: 'Navigationsleiste',
            description:
              'Titel und Schaltflächen bleiben lesbar, wenn du durch die Startseite, die Budgets oder ein Ziel scrollst.',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Allinea i miei conti',
            description:
              'Confronta il saldo dei tuoi conti con il saldo spuntato e correggi la differenza in un solo passaggio.',
          },
          {
            title: 'Riepilogo del mese',
            description:
              'All’inizio di un nuovo mese, un riepilogo riassume il mese concluso e l’importo riportato.',
          },
          {
            title: 'Spunta prioritaria',
            description:
              'La home mostra prima le previsioni che di solito spunti in questo momento del mese.',
          },
        ],
        fixes: [
          {
            title: 'Barra di navigazione',
            description:
              'Titolo e pulsanti restano leggibili quando scorri la home, i budget o un obiettivo.',
          },
        ],
      },
    },
  },
  {
    version: '0.49.0',
    iosVersion: '1.6.0',
    date: '2026-09-08',
    platforms: ['ios'],
    changes: {
      features: [
        {
          title: 'Planifier plusieurs mois',
          description:
            'Crée jusqu’à 36 budgets depuis un modèle, sans modifier les budgets existants.',
        },
        {
          title: 'Budgets plus lisibles',
          description:
            'Les prévisions portent les libellés « Mensuel » ou « Ponctuel », et le détail du budget s’allège sur iPhone.',
        },
      ],
      fixes: [
        {
          title: 'Navigation sur iPhone',
          description:
            'Revenir depuis un écran avec le clavier ouvert ne laisse plus d’espace vide.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Plan several months',
            description:
              'Create up to 36 budgets from a template without changing existing budgets.',
          },
          {
            title: 'Clearer budgets',
            description:
              'Forecasts are labelled “Monthly” or “One-off”, and budget details are simpler on iPhone.',
          },
        ],
        fixes: [
          {
            title: 'Navigation on iPhone',
            description:
              'Returning from a screen with the keyboard open no longer leaves an empty space.',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Mehrere Monate planen',
            description:
              'Erstelle bis zu 36 Budgets aus einer Vorlage, ohne bestehende Budgets zu verändern.',
          },
          {
            title: 'Übersichtlichere Budgets',
            description:
              'Planungen heissen «Monatlich» oder «Einmalig», und die Budgetdetails sind auf dem iPhone übersichtlicher.',
          },
        ],
        fixes: [
          {
            title: 'Navigation auf dem iPhone',
            description:
              'Beim Zurückkehren von einem Bildschirm mit geöffneter Tastatur bleibt kein leerer Bereich mehr.',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Pianifica più mesi',
            description:
              'Crea fino a 36 budget da un modello senza modificare quelli già presenti.',
          },
          {
            title: 'Budget più chiari',
            description:
              'Le previsioni sono indicate come «Mensile» o «Una tantum» e il dettaglio del budget è più semplice su iPhone.',
          },
        ],
        fixes: [
          {
            title: 'Navigazione su iPhone',
            description:
              'Tornando da una schermata con la tastiera aperta non resta più uno spazio vuoto.',
          },
        ],
      },
    },
  },
  {
    version: '0.49.0',
    date: '2026-09-08',
    platforms: ['android'],
    changes: {
      features: [
        {
          title: 'Planifier plusieurs mois',
          description:
            'Crée jusqu’à 36 budgets depuis un modèle, sans modifier les budgets existants.',
        },
      ],
      fixes: [],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Plan several months',
            description:
              'Create up to 36 budgets from a template without changing existing budgets.',
          },
        ],
        fixes: [],
      },
      de: {
        features: [
          {
            title: 'Mehrere Monate planen',
            description:
              'Erstelle bis zu 36 Budgets aus einer Vorlage, ohne bestehende Budgets zu verändern.',
          },
        ],
        fixes: [],
      },
      it: {
        features: [
          {
            title: 'Pianifica più mesi',
            description:
              'Crea fino a 36 budget da un modello senza modificare quelli già presenti.',
          },
        ],
        fixes: [],
      },
    },
  },
  {
    version: '0.48.0',
    iosVersion: '1.5.0',
    date: '2026-09-03',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Avis privé dans l’app',
          description:
            'Partage ton expérience en 30 secondes directement depuis Pulpe ; ton avis reste privé et n’est jamais publié sur l’App Store.',
        },
        {
          title: 'Pointage plus intuitif',
          description:
            'Les ronds réagissent désormais avec une animation et un retour haptique, tandis que l’aide contextuelle réapparaît après la mise à jour.',
        },
      ],
      fixes: [
        {
          title: 'Maintenance sans blocage',
          description:
            'Pulpe affiche correctement la maintenance au lieu de refuser un PIN valide et conserve Face ID activé.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Private in-app feedback',
            description:
              'Share your experience in 30 seconds directly from Pulpe; your feedback stays private and is never posted to the App Store.',
          },
          {
            title: 'More intuitive checking',
            description:
              'Circles now respond with animation and haptic feedback, while the contextual guide reappears after the update.',
          },
        ],
        fixes: [
          {
            title: 'Maintenance without lockouts',
            description:
              'Pulpe now displays maintenance correctly instead of rejecting a valid PIN and keeps Face ID enabled.',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Privates Feedback in der App',
            description:
              'Teile deine Erfahrung in 30 Sekunden direkt aus Pulpe; dein Feedback bleibt privat und wird nie im App Store veröffentlicht.',
          },
          {
            title: 'Intuitiveres Abgleichen',
            description:
              'Die Kreise reagieren neu mit Animation und haptischem Feedback; die kontextuelle Hilfe erscheint nach dem Update erneut.',
          },
        ],
        fixes: [
          {
            title: 'Wartung ohne Aussperrung',
            description:
              'Pulpe zeigt Wartungsarbeiten korrekt an, statt einen gültigen PIN abzulehnen, und lässt Face ID aktiviert.',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Feedback privato nell’app',
            description:
              'Condividi la tua esperienza in 30 secondi direttamente da Pulpe; la tua opinione resta privata e non viene mai pubblicata sull’App Store.',
          },
          {
            title: 'Spunta più intuitiva',
            description:
              'I cerchi ora reagiscono con un’animazione e un feedback aptico, mentre la guida contestuale riappare dopo l’aggiornamento.',
          },
        ],
        fixes: [
          {
            title: 'Manutenzione senza blocchi',
            description:
              'Pulpe mostra correttamente la manutenzione invece di rifiutare un PIN valido e mantiene Face ID attivo.',
          },
        ],
      },
    },
  },
  {
    version: '0.47.0',
    iosVersion: '1.4.3',
    date: '2026-08-29',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Un accueil repensé sur iOS',
          description:
            'L’accueil fait peau neuve : nouvelle en-tête illustrée, courbe du disponible à explorer du doigt et écrans harmonisés.',
        },
        {
          title: 'Modifier une ligne depuis l’accueil',
          description:
            'Touche une dépense ou un revenu dans l’activité récente pour l’ouvrir, le modifier ou le supprimer.',
        },
      ],
      fixes: [
        {
          title: 'Prénom affiché correctement',
          description:
            'Le prénom apparaît désormais quelle que soit la méthode de connexion : e-mail, Apple ou Google.',
        },
        {
          title: 'Soldes à jour dans la liste des budgets iOS',
          description:
            'Les soldes restent synchronisés après chaque modification.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'A redesigned iOS home',
            description:
              'The home screen gets a fresh look: a new illustrated header, a spending curve you can explore with your finger, and harmonised screens.',
          },
          {
            title: 'Edit a line from the home screen',
            description:
              'Tap an expense or income in the recent activity to open, edit or delete it.',
          },
        ],
        fixes: [
          {
            title: 'First name displayed correctly',
            description:
              'Your first name now appears regardless of the sign-in method: email, Apple or Google.',
          },
          {
            title: 'Up-to-date balances in the iOS budget list',
            description: 'Balances stay in sync after every change.',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Ein neu gestalteter iOS-Startbildschirm',
            description:
              'Der Startbildschirm im neuen Look: illustrierter Header, eine mit dem Finger erkundbare Ausgabenkurve und harmonisierte Ansichten.',
          },
          {
            title: 'Einträge direkt vom Start aus bearbeiten',
            description:
              'Tippe in der letzten Aktivität auf eine Ausgabe oder Einnahme, um sie zu öffnen, zu bearbeiten oder zu löschen.',
          },
        ],
        fixes: [
          {
            title: 'Vorname korrekt angezeigt',
            description:
              'Der Vorname erscheint jetzt unabhängig von der Anmeldemethode: E-Mail, Apple oder Google.',
          },
          {
            title: 'Aktuelle Salden in der iOS-Budgetliste',
            description: 'Die Salden bleiben nach jeder Änderung synchron.',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Una home iOS ridisegnata',
            description:
              'La schermata iniziale si rinnova: nuova intestazione illustrata, curva delle spese da esplorare con il dito e schermate armonizzate.',
          },
          {
            title: 'Modificare una riga dalla home',
            description:
              'Tocca una spesa o un’entrata nell’attività recente per aprirla, modificarla o eliminarla.',
          },
        ],
        fixes: [
          {
            title: 'Nome visualizzato correttamente',
            description:
              'Il nome appare ora indipendentemente dal metodo di accesso: e-mail, Apple o Google.',
          },
          {
            title: 'Saldi aggiornati nell’elenco budget iOS',
            description: 'I saldi restano sincronizzati dopo ogni modifica.',
          },
        ],
      },
    },
  },
  {
    version: '0.46.0',
    iosVersion: '1.4.2',
    date: '2026-08-22',
    platforms: ['web', 'ios'],
    changes: {
      features: [],
      fixes: [
        {
          title: 'Réglage de langue harmonisé',
          description:
            'Sur iOS, le sélecteur de langue s’intègre désormais naturellement aux autres préférences.',
        },
        {
          title: 'Connexion iOS plus fiable',
          description:
            'Un lancement en arrière-plan ne provoque plus de fausse déconnexion.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [],
        fixes: [
          {
            title: 'Consistent language settings',
            description:
              'On iOS, the language selector now fits naturally with the other preferences.',
          },
          {
            title: 'More reliable iOS sign-in',
            description:
              'A background launch no longer causes a false sign-out.',
          },
        ],
      },
      de: {
        features: [],
        fixes: [
          {
            title: 'Einheitliche Spracheinstellung',
            description:
              'Auf iOS fügt sich die Sprachauswahl jetzt natürlich in die übrigen Einstellungen ein.',
          },
          {
            title: 'Zuverlässigere iOS-Anmeldung',
            description:
              'Ein Start im Hintergrund führt nicht mehr zu einer falschen Abmeldung.',
          },
        ],
      },
      it: {
        features: [],
        fixes: [
          {
            title: 'Impostazione della lingua coerente',
            description:
              'Su iOS, il selettore della lingua ora si integra naturalmente con le altre preferenze.',
          },
          {
            title: 'Accesso iOS più affidabile',
            description:
              'Un avvio in background non causa più una falsa disconnessione.',
          },
        ],
      },
    },
  },
  {
    version: '0.45.0',
    iosVersion: '1.4.0',
    date: '2026-08-18',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Pulpe dans quatre langues',
          description:
            'Utilise Pulpe en français, anglais, allemand ou italien sur le web, le site et l’app iOS.',
        },
        {
          title: 'Objectifs plus lisibles sur iOS',
          description:
            'Le détail d’un objectif réunit une progression claire, une trajectoire simplifiée et un historique regroupé.',
        },
      ],
      fixes: [
        {
          title: 'Des montants exacts au centime',
          description:
            'Soldes, dépassements, objectifs et retraits restent cohérents jusque dans les petits écarts.',
        },
        {
          title: 'Suppression des prévisions liées',
          description:
            'Sur iOS, le choix attendu apparaît désormais depuis le détail de la prévision.',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Pulpe in four languages',
            description:
              'Use Pulpe in French, English, German or Italian across the web, website and iOS app.',
          },
          {
            title: 'Clearer goals on iOS',
            description:
              'Goal details now combine clear progress, a simpler trajectory and a grouped history.',
          },
        ],
        fixes: [
          {
            title: 'Amounts accurate to the cent',
            description:
              'Balances, overruns, goals and withdrawals remain consistent down to small differences.',
          },
          {
            title: 'Deleting linked forecasts',
            description:
              'On iOS, the expected choice now appears from the forecast details.',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Pulpe in vier Sprachen',
            description:
              'Nutze Pulpe auf der Webapp, der Website und in der iOS-App auf Französisch, Englisch, Deutsch oder Italienisch.',
          },
          {
            title: 'Übersichtlichere Ziele auf iOS',
            description:
              'Die Zieldetails verbinden einen klaren Fortschritt, einen vereinfachten Verlauf und eine gruppierte Historie.',
          },
        ],
        fixes: [
          {
            title: 'Beträge auf den Rappen genau',
            description:
              'Salden, Überschreitungen, Ziele und Auszahlungen bleiben auch bei kleinen Differenzen konsistent.',
          },
          {
            title: 'Verknüpfte Prognosen löschen',
            description:
              'Auf iOS erscheint die erwartete Auswahl nun direkt in den Prognosedetails.',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Pulpe in quattro lingue',
            description:
              'Usa Pulpe in francese, inglese, tedesco o italiano sul web, sul sito e nell’app iOS.',
          },
          {
            title: 'Obiettivi più chiari su iOS',
            description:
              'Il dettaglio di un obiettivo riunisce progressi chiari, un andamento semplificato e una cronologia raggruppata.',
          },
        ],
        fixes: [
          {
            title: 'Importi precisi al centesimo',
            description:
              'Saldi, sforamenti, obiettivi e prelievi restano coerenti anche nelle differenze minime.',
          },
          {
            title: 'Eliminazione delle previsioni collegate',
            description:
              'Su iOS, la scelta prevista appare ora direttamente nel dettaglio della previsione.',
          },
        ],
      },
    },
  },
  {
    version: '0.44.0',
    iosVersion: '1.3.2',
    date: '2026-08-14',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Trajectoire mensuelle',
          description:
            'L’accueil distingue ce qui est réalisé de ce qui reste prévu et estime le solde de fin de mois',
        },
        {
          title: 'Retraits depuis un objectif',
          description:
            'Un retrait peut être ajouté comme revenu dans le budget immédiatement ou planifié pour un mois futur',
        },
        {
          title: 'Épargne lissée liée aux objectifs',
          description:
            'Une épargne répartie sur plusieurs mois conserve l’objectif qu’elle alimente',
        },
      ],
      fixes: [
        {
          title: 'Plans d’épargne complétés',
          description:
            'Pulpe repère les versements absents des budgets déjà créés et permet de les ajouter après vérification',
        },
      ],
      technical: [],
    },
    translations: {
      en: {
        features: [
          {
            title: 'Monthly trajectory',
            description:
              'The home page separates completed activity from what is still planned and estimates the end-of-month balance',
          },
          {
            title: 'Withdrawals from a goal',
            description:
              'A withdrawal can be added to the budget as income immediately or scheduled for a future month',
          },
          {
            title: 'Goal-linked smoothed savings',
            description:
              'Savings spread over several months remain linked to the goal they fund',
          },
        ],
        fixes: [
          {
            title: 'Completed savings plans',
            description:
              'Pulpe finds contributions missing from budgets already created and lets you add them after review',
          },
        ],
      },
      de: {
        features: [
          {
            title: 'Monatsverlauf',
            description:
              'Die Startseite trennt erledigte Bewegungen von den noch geplanten und schätzt den Saldo zum Monatsende',
          },
          {
            title: 'Auszahlungen aus einem Ziel',
            description:
              'Eine Auszahlung kann sofort als Einnahme zum Budget hinzugefügt oder für einen späteren Monat geplant werden',
          },
          {
            title: 'Verteiltes Sparen bleibt mit Zielen verknüpft',
            description:
              'Über mehrere Monate verteiltes Sparen behält die Verknüpfung mit dem finanzierten Ziel',
          },
        ],
        fixes: [
          {
            title: 'Vervollständigte Sparpläne',
            description:
              'Pulpe erkennt fehlende Beiträge in bereits erstellten Budgets und lässt dich diese nach einer Prüfung ergänzen',
          },
        ],
      },
      it: {
        features: [
          {
            title: 'Andamento mensile',
            description:
              'La pagina iniziale separa ciò che è già avvenuto da ciò che resta pianificato e stima il saldo di fine mese',
          },
          {
            title: 'Prelievi da un obiettivo',
            description:
              'Un prelievo può essere aggiunto subito al budget come entrata o pianificato per un mese futuro',
          },
          {
            title: 'Risparmi distribuiti collegati agli obiettivi',
            description:
              'I risparmi distribuiti su più mesi restano collegati all’obiettivo che finanziano',
          },
        ],
        fixes: [
          {
            title: 'Piani di risparmio completati',
            description:
              'Pulpe individua i versamenti mancanti nei budget già creati e ti permette di aggiungerli dopo una verifica',
          },
        ],
      },
    },
  },
  {
    version: '0.40.0',
    iosVersion: '1.3.0',
    date: '2026-07-28',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Des objectifs plus flexibles',
          description:
            'Crée et adapte un objectif avec un début, une cible ou une échéance indépendamment optionnels',
        },
        {
          title: 'Une suppression maîtrisée',
          description:
            'Visualise l’impact avant de supprimer un objectif et choisis le sort de ses prévisions associées',
        },
        {
          title: 'Les objectifs visibles dans le budget',
          description:
            'Les prévisions indiquent désormais l’objectif d’épargne auquel elles contribuent',
        },
        {
          title: 'Les étiquettes arrivent sur iOS',
          description:
            'Ajoute, crée et consulte tes étiquettes depuis les transactions et les prévisions',
        },
      ],
      fixes: [],
      technical: [],
    },
  },
  {
    version: '0.39.0',
    iosVersion: '1.2.2',
    date: '2026-07-27',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Une trajectoire plus lisible',
          description:
            "Le graphique distingue clairement l'épargne confirmée, la projection du plan et la cible",
        },
      ],
      fixes: [
        {
          title: 'Une projection fidèle au plan',
          description:
            "Le montant estimé à l'échéance part désormais de l'épargne confirmée et ajoute les versements encore prévus",
        },
        {
          title: 'Des simulations plus fiables',
          description:
            'Une simulation ne peut plus réduire un montant déjà confirmé',
        },
      ],
      technical: [],
    },
  },
  {
    version: '0.38.3',
    iosVersion: '1.2.1',
    date: '2026-07-26',
    platforms: ['web', 'ios'],
    changes: {
      features: [],
      fixes: [
        {
          title: "Mensualités arrêtées à l'échéance",
          description:
            "La mensualité d'un objectif daté n'est plus ajoutée au Mois Type, où elle pouvait continuer à peser sur les budgets suivants",
        },
        {
          title: 'Écrans vides corrigés sur iOS',
          description:
            "Les pages sans budget, objectif ou modèle remplissent maintenant tout l'écran au lieu d'afficher une bande grise ; VoiceOver ignore aussi les icônes décoratives",
        },
      ],
      technical: [],
    },
  },
  {
    version: '0.38.0',
    iosVersion: '1.2.0',
    date: '2026-07-24',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: "Objectifs d'épargne",
          description:
            'Définis un objectif, suis sa progression prévue et confirmée, simule ton plan mensuel et visualise ta trajectoire',
        },
        {
          title: 'Tags',
          description:
            'Les étiquettes remplacent la catégorie en texte libre sur les transactions et les prévisions, avec un catalogue dans les réglages et un historique sur plusieurs mois',
        },
        {
          title: "Retrait d'épargne",
          description:
            'Un parcours dédié pour piocher dans ton épargne quand le mois est serré, avec suppression groupée et relance tant que le mois reste en déficit',
        },
        {
          title: "Nouvelle page d'accueil iOS",
          description:
            "Hiérarchie repensée autour du solde réel, fond adouci et objectifs d'épargne promus en onglet principal",
        },
      ],
      fixes: [],
      technical: [],
    },
  },
  {
    version: '0.37.0',
    iosVersion: '1.1.0',
    date: '2026-07-01',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Lisser une dépense',
          description:
            'Répartis une grosse dépense sur plusieurs mois et vois exactement ce qu’il reste à provisionner',
        },
        {
          title: 'Reporter une dépense',
          description:
            'Décale une dépense non pointée au mois suivant, en un geste',
        },
        {
          title: 'Gérer tes transactions',
          description:
            'Pointe, modifie ou supprime une transaction sans quitter ton budget',
        },
      ],
      fixes: [
        {
          title: 'Plus fluide au quotidien',
          description:
            'Clavier, déverrouillage hors ligne et confidentialité au retour dans l’app sont plus fiables',
        },
      ],
      technical: [],
    },
  },
  {
    version: '0.36.0',
    iosVersion: '1.0.4',
    date: '2026-06-19',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Affichage adapté au pays',
          description:
            'Dates, montants et formats suivent automatiquement ta devise : suisse (CHF) ou français (€)',
        },
        {
          title: 'Textes localisés CH/FR',
          description:
            "Suggestions d'épargne et libellés adaptés au pays ; le hero de la landing détecte le pays du visiteur",
        },
      ],
      fixes: [
        {
          title: 'Connexion iOS plus stable',
          description:
            'Fin des déconnexions intempestives quasi quotidiennes et du bouton Face ID inactif',
        },
        {
          title: 'Détail du budget (iOS)',
          description:
            'Suppression, rechargements simultanés, recherche par montant et erreurs de pointage fiabilisés',
        },
        {
          title: 'Solde annuel (iOS)',
          description:
            "Le potentiel de l'année s'appuie sur le solde de clôture cumulé",
        },
        {
          title: 'Onboarding',
          description:
            "Pied de page repositionné et nettoyage des modèles orphelins en cas d'échec de génération du budget",
        },
      ],
      technical: [],
    },
  },
  {
    version: '0.35.0',
    iosVersion: '1.0.3',
    date: '2026-05-14',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Refonte du détail budget (iOS)',
          description:
            'Navigation mois par mois, hero épuré, regroupement intelligent des transactions et prévisions, sections filtrables',
        },
        {
          title: 'Mise à jour forcée',
          description:
            'Sortie obligatoire des versions obsolètes (iOS + webapp) via vérification serveur au démarrage',
        },
        {
          title: 'Astuce parité web (iOS)',
          description:
            'Repère contextuel dans la liste des modèles pour orienter vers la webapp',
        },
        {
          title: 'Identifiant de corrélation',
          description:
            'X-Request-Id propagé entre webapp et backend pour faciliter le support',
        },
        {
          title: 'Effacement analytique (RGPD)',
          description:
            'Suppression automatique du profil PostHog lors de la suppression de compte',
        },
      ],
      fixes: [
        {
          title: "Barre d'onglets stable (iOS)",
          description:
            'Plus de saut visuel lors des navigations push/pop sur le détail budget',
        },
        {
          title: 'Durcissement sécurité (web + landing)',
          description:
            "Audit OWASP appliqué, retrait du 'unsafe-inline' dans la CSP, validation stricte des en-têtes X-Request-Id",
        },
      ],
      technical: [],
    },
  },
  {
    version: '0.34.0',
    iosVersion: '1.0.0',
    date: '2026-05-05',
    platforms: ['web', 'ios'],
    changes: {
      features: [
        {
          title: 'Multi-devise EUR/CHF',
          description:
            'Gestion complète des devises avec taux de change, formatage localisé et conversion automatique (activable via feature flag)',
        },
        {
          title: 'Convertisseur de devises',
          description:
            'Nouveau widget dans les Réglages pour convertir entre devises avec taux à jour',
        },
        {
          title: 'Refonte des modèles de budget',
          description:
            'Page modèles harmonisée avec la vue détail du budget pour une expérience cohérente',
        },
        {
          title: "Page d'accueil repensée",
          description:
            'Nouveau layout éditorial avec animations de transition entre vues',
        },
        {
          title: 'Devise sur iOS',
          description:
            'Formatage natif selon la locale et bascule de devise utilisateur',
        },
        {
          title: 'Clavier amélioré sur iOS',
          description:
            "Barre d'outils de navigation entre champs pendant l'onboarding",
        },
        {
          title: 'Onboarding iOS plus accessible',
          description:
            'En-têtes de section et chips suggérées avec meilleurs contrastes et focus',
        },
        {
          title: 'Suivi analytique devise',
          description: "Tracking de l'adoption du sélecteur de devise",
        },
      ],
      fixes: [
        {
          title: 'Tableau de bord',
          description:
            "Résolution d'un problème de course sur le pointage des prévisions",
        },
        {
          title: 'Réinitialisation des réglages',
          description: 'Nettoyage complet des données utilisateur au reset',
        },
        {
          title: 'Reprise iOS Safari',
          description: 'Récupération fiable après mise en veille longue',
        },
        {
          title: 'Erreurs en français',
          description: 'Messages de validation Zod traduits côté client',
        },
        {
          title: 'Séparateur décimal CHF',
          description: 'Cohérence du point décimal sur tous les écrans',
        },
        {
          title: 'Limite onboarding',
          description: 'Plafond de 50 transactions personnalisées dans l UI',
        },
        {
          title: 'Déconnexion iOS',
          description: 'Affichage des erreurs globales lors du sign out',
        },
        {
          title: 'Devise onboarding iOS',
          description:
            'Persistance correcte de la devise après configuration du code PIN',
        },
        {
          title: 'Biométrie iOS',
          description:
            "Bonne modalité affichée (Touch ID / Optic ID) selon l'appareil",
        },
        {
          title: 'Sécurité backend',
          description:
            "Protection contre l'IDOR sur la création de modèles, préservation de la clé de récupération sur échec de rekey, métadonnées FX persistées correctement",
        },
      ],
      technical: [],
    },
  },
  {
    version: '0.33.0',
    iosVersion: '1.0.0',
    date: '2026-04-08',
    platforms: ['ios'],
    changes: {
      features: [
        {
          title: "Confirmation de sortie de l'onboarding",
          description:
            "Une boîte de dialogue demande confirmation avant de quitter le parcours d'inscription",
        },
      ],
      fixes: [
        {
          title: 'Récupération automatique du nom via Apple/Google',
          description:
            'Le nom est désormais pré-rempli depuis les identifiants Apple ou Google, évitant une saisie manuelle inutile',
        },
        {
          title: 'Champ nom masqué pour les inscriptions sociales',
          description:
            'Le champ nom est correctement masqué pour toutes les connexions sociales lorsque le nom a été capturé',
        },
      ],
      technical: [],
    },
  },
];

/**
 * Product releases with an iOS marketing version that intentionally have no
 * dialog. Every entry must map to `landing/data/releases.json` and explain why
 * no approved note met the iOS curation threshold.
 */
export const SILENT_IOS_RELEASES: readonly SilentIosReleaseEntry[] = [
  {
    version: '0.45.1',
    reason:
      'Hotfix 1.4.1 limité à la fluidité du scroll vertical de l’accueil : ne pas interrompre à nouveau les utilisateurs et conserver la feuille complète des nouveautés 1.4.0 pour ceux qui ne l’ont pas encore vue',
  },
  {
    version: '0.42.0',
    reason:
      'Décision éditoriale : la seule correction iOS visible est le lien de réinitialisation du mot de passe qui ouvre désormais l’app, publiée sur le changelog public mais trop ponctuelle pour interrompre les utilisateurs au lancement ; le reste de la release est du durcissement invisible',
  },
];
