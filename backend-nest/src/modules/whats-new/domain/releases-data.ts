export interface WhatsNewReleaseChangeItem {
  title: string;
  description: string;
}

export interface WhatsNewReleaseEntry {
  version: string;
  /**
   * iOS marketing version that shipped this projection. A release intentionally
   * without a dialog is recorded in `SILENT_IOS_RELEASES` instead of being
   * omitted implicitly or represented by an incomplete projection.
   */
  iosVersion: string;
  date: string;
  platforms: ('android' | 'ios' | 'web')[];
  changes: {
    features: WhatsNewReleaseChangeItem[];
    fixes: WhatsNewReleaseChangeItem[];
    technical: WhatsNewReleaseChangeItem[];
  };
}

export interface SilentIosReleaseEntry {
  readonly version: string;
  readonly reason: string;
}

/**
 * Checked-in iOS projection of `landing/data/releases.json` (maintained by the
 * `/release` skill). The deployed backend artifact does not contain
 * the `landing/` package, so the data lives here as a TypeScript literal rather
 * than being read from disk at runtime. Keep release metadata in sync and this
 * list ordered newest-first, but include only releases mapped to an iOS
 * marketing version. `githubUrl`, technical changes, and unmapped releases are
 * dropped.
 */
export const RELEASES: WhatsNewReleaseEntry[] = [
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
    version: '0.42.0',
    reason:
      'Décision éditoriale : la seule correction iOS visible est le lien de réinitialisation du mot de passe qui ouvre désormais l’app, publiée sur le changelog public mais trop ponctuelle pour interrompre les utilisateurs au lancement ; le reste de la release est du durcissement invisible',
  },
];
