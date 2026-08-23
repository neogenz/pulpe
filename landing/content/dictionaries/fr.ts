// Catalogue source. Les trois autres langues sont typées contre celui-ci.
//
// Ce fichier porte deux espaces invisibles, reprises telles quelles du markup
// d’origine : une insécable fine U+202F devant les `?` des questions de la page
// support, et une insécable pleine U+00A0 dans les titres qui portaient un
// `&nbsp;`. Elles ne se voient pas dans un diff, donc un test les compte.
// Aucune des trois autres langues n’en met.

interface Testimonial {
  lead: string;
  highlight: string;
  tail: string;
  name: string;
  since: string;
}

const testimonials: Testimonial[] = [
  {
    lead: "Je stresse moins. J’ai une vue d’ensemble, et ",
    highlight: "les dépenses que je ne voyais pas venir",
    tail: ", je les vois arriver maintenant.",
    name: "Ismaël S.",
    since: "Utilisateur depuis novembre 2025",
  },
  {
    lead: "Je vois tout de suite ",
    highlight: "où en est mon budget",
    tail: ". C’est pratique, clair et beaucoup plus simple à suivre.",
    name: "Sylvie G.",
    since: "Utilisatrice depuis mai 2026",
  },
  {
    lead: "Je peux ",
    highlight: "prévoir nos vacances sur l’année",
    tail: " et voir tout de suite si ça rentre dans notre budget. Ça me rassure.",
    name: "Julie D.",
    since: "Utilisatrice depuis décembre 2025",
  },
];

const fr = {
  site: {
    titleDefault:
      "Pulpe – App de budget | Planifie ton année, vois combien il te restera",
    titleTemplate: "%s | Pulpe",
    description:
      "App de budget pour planifier tes revenus, tes dépenses et ton épargne. Pulpe te montre combien il te restera chaque mois, sans connexion bancaire.",
    socialImageAlt:
      "Pulpe projette ton budget sur l’année et montre combien il te restera",
    // Repris dans les deux nœuds du graphe JSON-LD.
    graphDescription:
      "Pulpe est une app de budget pour planifier son année, sans connexion bancaire.",
    featureList: [
      "Planification annuelle",
      "Disponible à dépenser chaque mois",
      "Sans connexion bancaire",
    ],
    // Les deux lignes propres à la carte sociale, plus courtes que celles de la
    // page : à 1200×630 une phrase de plus déborde du cadre.
    socialCard: {
      subhead: "Planifie ton année. Vois combien il te restera chaque mois.",
      badge: "Gratuit · Sans connexion bancaire",
    },
  },

  common: {
    skipToContent: "Aller au contenu",
  },

  header: {
    navAriaLabel: "Navigation principale",
    mobileNavAriaLabel: "Navigation mobile",
    menuLabel: "Menu",
    homeAriaLabel: "Pulpe, accueil",
    cta: "Créer mon budget",
    nav: {
      painPoints: "Pourquoi Pulpe",
      howItWorks: "Comment ça marche",
      platforms: "Applications",
      support: "Aide",
      whyFree: "Pourquoi c’est gratuit",
    },
  },

  footer: {
    tagline: "Le budget tourné vers les mois qui viennent. Créé en Suisse.",
    navAriaLabel: "Liens utiles",
    groups: {
      discover: "Découvrir",
      help: "Aide",
      legal: "Légal",
    },
    links: {
      source: "Code source",
      terms: "Conditions",
      privacy: "Confidentialité",
      changelog: "Nouveautés",
      support: "FAQ et tutoriels",
      contact: "Contact",
    },
  },

  home: {
    hero: {
      // Le surligneur porte la fin de la promesse, jamais la phrase entière.
      headlineLead: "Tu sais des mois à l’avance ",
      headlineHighlight: "combien il te restera.",
      subheadLead: "Planifie ton budget ",
      subheadEmphasis: "sur l’année",
      subheadTail:
        ". Tu vois combien il te restera chaque mois pour préparer tes projets plus sereinement.",
      cta: "Créer mon budget gratuitement",
      reassurance: "Gratuit · Montants chiffrés · Aucune connexion bancaire",
    },

    dashboard: {
      caption: "Aperçu du tableau de bord Pulpe",
      title: "Tableau de bord",
      scope: "Vue annuelle",
      currentMonth: "Mois en cours",
      available: "Disponible ce mois",
      spent: "Dépensé",
      outOf: "sur",
      note: "Tes grosses dépenses sont déjà intégrées aux mois qui arrivent.",
      previsionsTitle: "Prévisions du mois",
      previsions: {
        rent: "Loyer",
        insurance: "Assurance",
        electricity: "Électricité",
      },
      projectionTitle: "Projection du solde",
      projectionHint: "Tu vois venir",
      projectionAriaLabel: "Projection du solde en hausse sur l’année",
    },

    painPoints: {
      heading:
        "Les impôts tombent en juillet. Tu sais déjà combien il te restera en août.",
      intro:
        "Une grosse dépense tombe un mois, mais son effet se fait sentir bien après. Avec un tableur, tu dois recalculer la suite. Une app de suivi ne la montre qu’une fois payée.",
      spreadsheet: {
        title: "Avec un tableur, tu dois tout tenir à jour.",
        text: "Au moindre changement, tu modifies les lignes, les mois et parfois les formules. Si ton fichier n’est plus à jour, ta projection ne l’est plus non plus.",
      },
      tracking: {
        title: "Le suivi commence une fois l’argent dépensé.",
        text: "Une app de suivi t’explique où ton argent est parti. Elle t’aide moins à savoir si une dépense prévue en septembre tient encore dans ton budget.",
      },
    },

    solution: {
      headingLead: "Pars d’un mois type. ",
      headingHighlight: "Pulpe projette la suite.",
      intro:
        "Tu pars d’un mois habituel. Pulpe s’en sert pour préparer les suivants. Ensuite, tu places les impôts, les vacances et les gros achats dans les mois concernés.",
    },

    howItWorks: {
      // Chaque légende est coupée autour de l’unité monétaire, qui suit le
      // visiteur et non la langue de la page.
      steps: {
        template: {
          title: "Renseigne un mois habituel",
          description:
            "Ajoute tes revenus, tes dépenses récurrentes et ce que tu veux mettre de côté.",
          captionLead: "Ton mois type : sur 3 500 ",
          captionTail:
            " de revenu, 1 600 de dépenses récurrentes et 500 d’épargne laissent 1 400 disponibles chaque mois",
        },
        year: {
          title: "Place ce qui change",
          description:
            "Ajoute les impôts, les vacances et les gros achats dans les mois où ils auront lieu.",
          captionLead: "Ton année : douze mois à 1 400 ",
          captionTail:
            " disponibles, sauf juillet à 500 pour les impôts, août à 700 pour les vacances et décembre à 200 pour un gros achat",
        },
        month: {
          title: "Vois combien il te restera",
          description:
            "Ouvre un mois à venir pour voir ton disponible, puis ajuste ton budget si besoin.",
          captionLead: "Juillet : sur 3 500 ",
          captionTail:
            " de revenu, 1 600 de récurrent, 500 d’épargne et 900 d’impôts laissent 500 disponibles",
        },
      },
      visuals: {
        templateTitle: "Ton mois type",
        yearTitle: "Ton année",
        monthTitle: "Juillet, à venir",
        income: "Revenu",
        recurring: "Récurrent",
        saving: "Épargne",
        tax: "Impôts",
        available: "Disponible",
        templatePayoff: "Disponible à dépenser, chaque mois",
        monthPayoff: "Il te restera en juillet",
        yearLegend: "Juillet, impôts · Août, vacances · Décembre, gros achat",
        // Une initiale par mois, de janvier à décembre, dans l’ordre.
        monthInitials: [
          "J",
          "F",
          "M",
          "A",
          "M",
          "J",
          "J",
          "A",
          "S",
          "O",
          "N",
          "D",
        ],
      },
    },

    testimonials: {
      eyebrow: "Témoignages",
      heading: "Pourquoi ils utilisent Pulpe.",
      // Les prénoms ne se traduisent pas ; le rôle et l’ancienneté oui, et
      // l’ancienneté s’accorde au genre en français.
      items: testimonials,
    },

    features: {
      headingLead: "Quand tes plans changent, ",
      headingHighlight: "Pulpe recalcule la suite.",
      spread: {
        title: "Répartis une grosse dépense sur plusieurs mois.",
        bodyEmphasis: "Le total ne change pas.",
        bodyTail:
          " Tu choisis les mois, Pulpe calcule la part de chacun et te montre ce qu’il reste à mettre de côté.",
        mockLabel: "Assurance annuelle",
        mockMonths: ["Mai", "Juin", "Juil.", "Août"],
      },
      goal: {
        title: "Avance vers ton objectif, même si un mois change.",
        body: "Fixe une cible et une date. Tu vois les épargnes qui y contribuent et peux répartir le reste sur les mois suivants.",
        mockLabel: "Vacances",
        mockDeadline: "Pour septembre",
        mockRemaining: "Reste réparti",
        mockMonths: ["Août", "Sept."] as [string, string],
      },
    },

    platforms: {
      heading: "Ton budget te suit. Pas l’inverse.",
      intro:
        "Sur iPhone ou dans ton navigateur, tu retrouves la même année et les mêmes chiffres.",
      ios: {
        badge: "Disponible",
        title: "Pulpe pour iPhone",
        text: "Une app native avec notifications, widgets et Face ID, pensée pour consulter et mettre à jour ton budget partout.",
        storeAriaLabel: "Télécharger Pulpe sur l’App Store",
        storeBadgeAlt: "Télécharger sur l’App Store",
      },
      web: {
        title: "Dans ton navigateur",
        text: "Ouvre Pulpe dans ton navigateur, sur ordinateur ou mobile. Rien à installer.",
        cta: "Ouvrir l’app web",
      },
      android: {
        title: "Android",
        badge: "Bientôt",
        text: "L’app native est en cours. La version Web fonctionne déjà sur mobile Android.",
      },
    },

    whyFree: {
      portraitAlt: "Maxime, créateur de Pulpe",
      eyebrow: "Une note du créateur",
      heading: "J’avais besoin d’un budget qui regarde devant.",
      paragraphs: [
        "J’ai créé Pulpe après avoir passé trop de temps à tenir mes tableurs à jour. Je voulais savoir ce qu’une décision changerait dans les mois suivants, pas seulement comprendre où mon argent était parti.",
        "Le projet est gratuit aujourd’hui, sans publicité ni abonnement. Son code reste public pour que tu puisses vérifier son fonctionnement.",
      ],
      signature: "Maxime, créateur de Pulpe",
      sourceLink: "Voir le code source",
      guarantees: {
        encryption: {
          title: "Montants protégés",
          text: "Tes montants ne sont pas stockés en clair. Ils sont chiffrés avec AES-256-GCM à l’aide de deux clés conservées séparément.",
        },
        analytics: {
          title: "Mesure d’usage en Europe",
          text: "Les données d’usage qui servent à améliorer Pulpe sont traitées sur les serveurs européens de PostHog.",
        },
        openSource: {
          title: "Code ouvert",
          text: "Le code source est public : tu peux voir comment Pulpe fonctionne et comment tes montants sont protégés.",
        },
      },
    },

    faq: {
      heading: "Les questions qu’on me pose le plus.",
      // `isOpen` reste dans le composant : c’est une décision de mise en page,
      // pas de la copie, et elle vaut pour les quatre langues.
      items: [
        {
          question: "C’est une app de gestion de budget ?",
          answer:
            "Oui. C’est comme ça que les gens l’appellent. Pulpe sert surtout à planifier l’année : tu vois combien il te restera chaque mois, au lieu de seulement recenser ce qui est déjà dépensé.",
        },
        {
          question: "Pourquoi Pulpe plutôt qu’Excel ?",
          answer:
            "Excel fait le job, mais les formules deviennent vite fragiles dès que tu bouges une ligne. Et sur mobile, c’est pénible. Pulpe garde la vue d’ensemble et recalcule la suite quand tu ajustes ton budget.",
        },
        {
          question: "C’est vraiment gratuit ?",
          answer:
            "Oui. Pulpe est aujourd’hui gratuit, sans publicité ni abonnement. Le projet est personnel et son code source est public.",
        },
        {
          question: "Je récupère mes données si j’arrête ?",
          answer:
            "Oui. Tu peux exporter tes budgets depuis l’app. Tes données ne sont pas enfermées dans Pulpe.",
        },
        {
          question: "Mes montants sont-ils protégés ?",
          answer:
            "Oui. Tes montants ne sont jamais stockés en clair. Ils sont chiffrés en base avec AES-256-GCM. Ils sont déchiffrés côté serveur pendant tes requêtes authentifiées grâce à deux clés conservées séparément, dont une dérivée de ton code PIN. Une fuite de la base seule ne suffit donc pas à les lire. Tes montants et libellés financiers ne sont ni transmis à des fins publicitaires ni revendus. Le code source est public.",
        },
        {
          question: "Pourquoi pas de connexion à ma banque ?",
          answer:
            "J’aurais aimé proposer une synchronisation bancaire. Pour le faire correctement en Suisse et en France, il faut passer par des prestataires externes et gérer des contraintes réglementaires. Pour un projet que je développe seul, le soir après le boulot, le coût est trop élevé. Donc, pour l’instant, la saisie reste manuelle.",
        },
        {
          question: "Combien de temps faut-il pour commencer ?",
          answer:
            "Quelques minutes suffisent : renseigne un mois habituel, ajoute les dépenses ponctuelles que tu connais, puis consulte la projection de ton année.",
        },
      ],
    },

    finalCta: {
      heading: "Prépare ton année. Vois combien il te restera chaque mois.",
      body: "Commence gratuitement, sans connecter tes comptes bancaires. Tes montants sont chiffrés en base de données, et ne sont jamais revendus.",
      cta: "Créer mon budget gratuitement",
      arrowNote: "Prêt à respirer ?",
    },

    stickyCta: "Créer mon budget gratuitement",
  },

  support: {
    metaTitle: "Aide et questions fréquentes",
    metaDescription:
      "Tutoriels et réponses pour utiliser Pulpe : comprendre les modèles et budgets, protéger ses montants et gérer son compte.",
    heading: "Comment puis-je t’aider ?",
    intro:
      "Des tutoriels courts pour utiliser Pulpe, puis les réponses aux questions fréquentes. Si la tienne manque, écris-moi.",
    guidesHeading: "Bien démarrer avec Pulpe.",
    guideCard: {
      eyebrow: "Tutoriel",
      title: "Modèle ou budget : que faut-il modifier ?",
      text: "Choisis le bon endroit selon que ton changement concerne un seul mois ou tes mois habituels.",
    },
    assistantCard: {
      eyebrow: "Tutoriel",
      title: "Connecter Pulpe à un assistant IA",
      text: "Branche ChatGPT, Claude ou Claude Code sur ton budget, en lecture seule ou avec le droit d’écrire.",
    },
    faqHeading: "Les questions qu’on me pose le plus.",
    // `plainAnswer` n’est plus écrit à la main : il est dérivé du texte
    // ci-dessous pour le JSON-LD, donc les deux ne peuvent plus diverger.
    faq: {
      purpose: {
        question: "À quoi sert Pulpe, concrètement ?",
        answer:
          "Tu poses ton année une fois, puis tu ajustes au fur et à mesure. Si tu déplaces une dépense, rediriges de l’épargne ou décales un projet, tu vois ce que ça change sur les mois suivants sans repartir de zéro.",
      },
      excel: {
        question: "Pourquoi Pulpe plutôt qu’Excel ?",
        answer:
          "Excel fait le job, mais les formules deviennent vite fragiles dès que tu bouges une ligne. Et sur mobile, c’est pénible. Pulpe garde la vue d’ensemble et recalcule la suite quand tu ajustes ton budget.",
      },
      bank: {
        question: "Pourquoi Pulpe ne se connecte pas à ma banque ?",
        answer:
          "J’aurais aimé proposer une synchronisation bancaire. Pour le faire correctement en Suisse et en France, il faut passer par des prestataires externes et gérer des contraintes réglementaires. Pour un projet que je développe seul, le soir après le boulot, le coût est trop élevé. Donc, pour l’instant, la saisie reste manuelle.",
      },
      trust: {
        question: "Pourquoi confier mes chiffres à Pulpe ?",
        answerBefore:
          "Tes montants ne sont jamais stockés en clair. Ils sont chiffrés en base avec AES-256-GCM. Ils sont déchiffrés côté serveur pendant tes requêtes authentifiées grâce à deux clés conservées séparément, dont une dérivée de ton code PIN. Une fuite de la base seule ne suffit donc pas à les lire. Tes montants et libellés financiers ne sont ni transmis à des fins publicitaires ni revendus. Le ",
        answerLink: "code source est public",
        answerAfter:
          ", tu peux vérifier son fonctionnement au lieu de me croire sur parole.",
      },
      demo: {
        question: "Est-ce que je peux essayer sans créer de compte ?",
        answerBefore: "Oui. Le ",
        answerLink: "mode démo",
        answerAfter:
          " te laisse utiliser Pulpe sans compte et sans saisir tes propres chiffres.",
      },
      free: {
        question: "C’est vraiment gratuit ?",
        answerBefore:
          "Oui. Pulpe est gratuit, sans publicité ni abonnement. C’est un projet solo et son ",
        answerLink: "code source est public",
        answerAfter: ".",
      },
      countries: {
        question: "Ça marche en Suisse et en France ?",
        answer:
          "Oui. Pulpe fonctionne avec les francs suisses et les euros, sur le web et sur iPhone.",
      },
      sync: {
        question: "Comment retrouver mes budgets entre le web et l’iPhone ?",
        answer:
          "Connecte-toi au même compte sur les deux. Tes budgets et tes modifications sont synchronisés automatiquement.",
      },
      deletion: {
        question: "Comment supprimer mon compte et mes données ?",
        answerBefore: "Tu peux demander la suppression depuis les ",
        answerLink: "paramètres",
        answerAfter:
          ". Le compte et tes données sont alors programmés pour être supprimés dans trois jours, ce qui te laisse ce délai pour changer d’avis. Passé ce délai, ils sont supprimés des systèmes actifs. Des copies peuvent subsister temporairement dans les sauvegardes techniques, puis expirent selon la politique de rétention du fournisseur d’hébergement.",
      },
    },
    contactHeading: "Ta question n’est pas là ?",
    contactText:
      "Écris-moi directement. Je développe Pulpe seul et je réponds moi-même.",
    contactGithub: "Bug ou suggestion sur GitHub",
  },

  guide: {
    metaTitle: "Modèle ou budget : que faut-il modifier ?",
    metaDescription:
      "Comprendre la différence entre un modèle et un budget mensuel dans Pulpe, puis savoir lequel modifier sur iPhone.",
    backToSupport: "Aide",
    eyebrow: "Modèles et budgets",
    heading: "Modèle ou budget : que faut-il modifier ?",
    intro:
      "Le modèle prépare tes mois habituels. Un budget représente un mois précis.",
    differenceHeading: "La différence en une phrase.",
    template: {
      eyebrow: "Le modèle",
      title: "Ta base de départ",
      text: "Il contient tes revenus, dépenses et épargnes habituels. Il sert à préparer tes budgets mensuels sans tout ressaisir.",
    },
    budget: {
      eyebrow: "Le budget",
      title: "Un mois précis",
      text: "Il correspond par exemple à août 2026. Tu peux l’ajuster pour ce mois sans changer ta base habituelle.",
    },
    choiceHeading: "Choisis selon ce que tu veux changer.",
    choices: [
      {
        intent: "Changer uniquement ce mois-ci",
        destination: "Le budget du mois",
      },
      { intent: "Changer mes mois habituels", destination: "Le modèle" },
      { intent: "Créer le prochain mois", destination: "Un nouveau budget" },
      {
        intent: "Créer une autre base réutilisable",
        destination: "Un nouveau modèle",
      },
    ],
    iphoneEyebrow: "Sur iPhone",
    iphoneHeading: "Les deux parcours, étape par étape.",
    budgetSteps: {
      eyebrow: "Un seul mois",
      title: "Modifier un budget mensuel",
      steps: [
        "Ouvre l’onglet « Budgets ».",
        "Touche + pour créer le budget du prochain mois, ou ouvre un mois existant.",
        "Dans le budget, touche + pour ajouter une prévision.",
        "Touche une prévision existante pour la modifier ou la supprimer.",
      ],
    },
    modelSteps: {
      eyebrow: "Tes mois habituels",
      title: "Modifier le modèle",
      steps: [
        "Ouvre l’onglet « Modèles ».",
        "Touche + pour créer une nouvelle base, ou ouvre un modèle existant.",
        "Touche une prévision existante pour la modifier.",
        "Choisis « Appliquer » pour reporter la modification sur les budgets en cours et futurs.",
      ],
    },
    protectedTitle: "Tes ajustements restent protégés",
    protectedParagraphs: [
      "Quand tu choisis « Appliquer », Pulpe met à jour les budgets en cours et futurs. Une prévision déjà modifiée manuellement dans un budget n’est pas remplacée.",
      "Sur iPhone, tu peux créer un modèle et modifier ses prévisions. Pour ajouter ou supprimer une prévision dans un modèle déjà créé, utilise actuellement la version web.",
    ],
    contactHeading: "Toujours bloqué ?",
    contactText:
      "Écris-moi en précisant l’écran où tu te trouves. Je te répondrai directement.",
  },

  assistant: {
    metaTitle: "Connecter Pulpe à un assistant IA",
    metaDescription:
      "Brancher Pulpe sur ChatGPT, Claude ou Claude Code : ce que l’assistant sait faire, comment l’autoriser, et où couper l’accès.",
    backToSupport: "Aide",
    eyebrow: "Assistants IA",
    heading: "Parler de ton budget à ton assistant",
    intro:
      "Tu peux brancher Pulpe sur ChatGPT, sur Claude ou sur Claude Code, puis demander où tu en es ce mois-ci ou noter une dépense sans ouvrir l’app.",
    abilitiesHeading: "Ce que ton assistant sait faire.",
    abilities: [
      "Te dire ce qu’il te reste à dépenser ce mois-ci, et d’où vient le chiffre.",
      "Lire tes prévisions, tes mouvements et tes objectifs d’épargne.",
      "Noter une dépense, un revenu ou une épargne, puis la pointer.",
      "Étaler une grosse dépense sur plusieurs mois.",
      "Créer le budget d’un mois à partir d’un de tes modèles.",
    ],
    sourceTitle: "Les chiffres restent ceux de Pulpe",
    sourceText:
      "L’assistant ne recalcule rien. Il lit les mêmes montants que ton app, et c’est Pulpe qui fait foi. La façon dont il les met en phrases lui appartient, donc relis-le comme tu relirais un brouillon.",
    modeHeading: "Décide ce qu’il a le droit de faire.",
    modeIntro:
      "Tu choisis au moment d’autoriser la connexion. Tu peux changer d’avis ensuite : coupe-la, puis rebranche-la dans l’autre mode.",
    readMode: {
      eyebrow: "Lecture seule",
      title: "Il regarde, il ne touche à rien",
      text: "Il répond à tes questions sur le mois en cours et sur ton année. Rien ne bouge dans tes budgets, même si tu le lui demandes.",
    },
    writeMode: {
      eyebrow: "Lecture et écriture",
      title: "Il note à ta place",
      text: "En plus de lire, il peut ajouter une dépense, la pointer, ou créer le budget du mois prochain. Il annonce ce qu’il s’apprête à faire avant de le faire.",
    },
    connectEyebrow: "Le branchement",
    connectHeading: "Brancher Pulpe, une seule fois.",
    addressLabel: "L’adresse à coller, la même partout",
    availabilityNote:
      "Les connecteurs personnalisés ne sont ouverts ni sur toutes les formules, ni sur toutes les versions. Si tu ne trouves pas l’écran décrit ici, c’est que ton assistant ne les propose pas encore.",
    clients: [
      {
        name: "ChatGPT",
        steps: [
          "Ouvre les réglages, puis la section des connecteurs.",
          "Ajoute un connecteur et colle l’adresse ci-dessus.",
          "Autorise l’accès sur la page Pulpe qui s’ouvre.",
        ],
      },
      {
        name: "Claude",
        steps: [
          "Ouvre les réglages, puis la section des connecteurs.",
          "Ajoute un connecteur personnalisé avec l’adresse ci-dessus.",
          "Autorise l’accès sur la page Pulpe qui s’ouvre.",
        ],
      },
      {
        name: "Claude Code",
        steps: [
          "Lance la commande ci-dessous dans ton terminal.",
          "Autorise l’accès dans le navigateur qui s’ouvre.",
          "Reviens au terminal : la connexion est active.",
        ],
      },
    ],
    commandLabel: "Dans le terminal",
    consentTitle: "Ce que tu vois au moment d’autoriser",
    consentSteps: [
      "Tu te connectes à ton compte Pulpe, comme sur le web.",
      "Tu saisis ton code, celui qui déverrouille tes montants.",
      "Tu choisis lecture seule ou lecture et écriture, puis tu valides.",
    ],
    revokeHeading: "Couper l’accès quand tu veux.",
    revokeText:
      "Une connexion coupée l’est tout de suite : l’assistant ne lit plus rien et n’écrit plus rien, sans délai.",
    revokeSteps: [
      "Ouvre Pulpe, puis les paramètres.",
      "Va dans la liste de tes connexions.",
      "Coupe celle dont tu ne veux plus.",
    ],
    revokeNote:
      "Changer ton code ou récupérer ton coffre coupe aussi toutes les connexions d’un coup. C’est volontaire : tes assistants n’ont alors plus de quoi ouvrir tes montants, et tu les rebranches quand tu veux.",
    contactHeading: "Ça coince au branchement ?",
    contactText:
      "Écris-moi en précisant l’assistant et l’écran où tu bloques. Je développe Pulpe seul et je réponds moi-même.",
  },

  changelog: {
    metaTitle: "Nouveautés",
    metaDescription:
      "Toutes les nouveautés et corrections de Pulpe. Suivez les mises à jour de l’app web, iOS et Android.",
    heading: "Nouveautés",
    intro: "Les dernières mises à jour de Pulpe.",
    // Le corps des notes de version reste en français dans les quatre langues :
    // `data/releases.json` est lu verbatim par un test de parité du backend.
    sections: {
      features: "Nouveautés",
      fixes: "Corrections",
      technical: "Technique",
    },
    githubRelease: "GitHub Release",
    frenchArchive: "Voir l’archive complète en français",
  },

  notFound: {
    title: "Cette page n’existe pas",
    text: "Le chemin demandé est inconnu. Utilise les liens ci-dessous pour retrouver une page utile.",
    appCta: "Accéder à l’app",
    homeCta: "Retour à l’accueil",
  },

  // Le libellé du sélecteur est le seul texte de langue qui suive la page ; le
  // bandeau, lui, parle celle qu’il propose et vit donc dans `lib/i18n.ts`.
  language: {
    switcherLabel: "Langue",
  },
};

export default fr;
