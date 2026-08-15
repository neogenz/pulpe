import type { Dictionary } from "../dictionary";

// L’italiano dà del tu, mai del Lei. Nessuno spazio prima di `?`: quella è
// tipografia francese. I termini di prodotto seguono il lessico fissato in
// `docs/I18N.md`.
const it: Dictionary = {
  site: {
    titleDefault: "Pulpe | Sai con mesi di anticipo quanto ti resterà",
    titleTemplate: "%s | Pulpe",
    description:
      "Pianifica le tue entrate, le tue spese e il tuo risparmio. Pulpe ti mostra quanto ti resterà ogni mese, senza collegamento bancario.",
    socialImageAlt:
      "Pulpe proietta il tuo budget sull’anno e mostra quanto ti resterà",
    graphDescription:
      "Pulpe calcola mese dopo mese quanto hai a disposizione a partire dalle tue entrate, dalle tue spese e dal tuo risparmio, senza collegamento bancario.",
    socialCard: {
      subhead: "Pianifica il tuo anno. Vedi ogni mese quanto ti resta.",
      badge: "Gratis · Senza collegamento bancario",
    },
  },

  common: {
    skipToContent: "Vai al contenuto",
  },

  header: {
    navAriaLabel: "Navigazione principale",
    mobileNavAriaLabel: "Navigazione mobile",
    menuLabel: "Menu",
    homeAriaLabel: "Pulpe, pagina iniziale",
    cta: "Crea il mio budget",
    nav: {
      painPoints: "Perché Pulpe",
      howItWorks: "Come funziona",
      platforms: "App",
      support: "Aiuto",
      whyFree: "Perché è gratis",
    },
  },

  footer: {
    tagline: "Il budget rivolto ai mesi che arrivano. Creato in Svizzera.",
    navAriaLabel: "Link utili",
    groups: {
      discover: "Scopri",
      help: "Aiuto",
      legal: "Note legali",
    },
    links: {
      source: "Codice sorgente",
      terms: "Condizioni",
      privacy: "Privacy",
      changelog: "Novità",
      support: "FAQ e tutorial",
      contact: "Contatti",
    },
  },

  home: {
    hero: {
      headlineLead: "Sai con mesi di anticipo ",
      headlineHighlight: "quanto ti resterà.",
      subheadLead: "Pianifica il tuo budget ",
      subheadEmphasis: "sull’anno intero",
      subheadTail:
        ". Vedi quanto ti resterà ogni mese e prepari i tuoi progetti con più serenità.",
      cta: "Crea il mio budget gratis",
      reassurance: "Gratis · Importi cifrati · Nessun collegamento bancario",
    },

    dashboard: {
      caption: "Anteprima della dashboard di Pulpe",
      title: "Dashboard",
      scope: "Vista annuale",
      currentMonth: "Mese in corso",
      available: "Disponibile questo mese",
      spent: "Speso",
      outOf: "su",
      note: "Le tue spese grosse sono già inserite nei mesi che arrivano.",
      previsionsTitle: "Previsioni del mese",
      previsions: {
        rent: "Affitto",
        insurance: "Assicurazione",
        electricity: "Elettricità",
      },
      projectionTitle: "Proiezione del saldo",
      projectionHint: "Lo vedi arrivare",
      projectionAriaLabel: "Proiezione del saldo in crescita sull’anno",
    },

    painPoints: {
      heading:
        "Le tasse arrivano a luglio. Sai già quanto ti resterà ad agosto.",
      intro:
        "Una spesa grossa cade in un mese, ma il suo effetto si sente ben oltre. Con un foglio di calcolo devi ricalcolare il resto. Un’app di monitoraggio te la mostra solo una volta pagata.",
      spreadsheet: {
        title: "Con un foglio di calcolo devi tenere tutto aggiornato.",
        text: "Al minimo cambiamento modifichi le righe, i mesi e a volte le formule. Se il tuo file non è più aggiornato, non lo è più nemmeno la tua proiezione.",
      },
      tracking: {
        title: "Il monitoraggio comincia a soldi già spesi.",
        text: "Un’app di monitoraggio ti spiega dove sono finiti i tuoi soldi. Ti aiuta meno a sapere se una spesa prevista a settembre rientra ancora nel tuo budget.",
      },
    },

    solution: {
      headingLead: "Parti da un mese tipo. ",
      headingHighlight: "Pulpe proietta il resto.",
      intro:
        "Parti da un mese abituale. Pulpe lo usa per preparare i successivi. Poi collochi le tasse, le vacanze e gli acquisti importanti nei mesi in cui cadono.",
    },

    howItWorks: {
      steps: {
        template: {
          title: "Inserisci un mese abituale",
          description:
            "Aggiungi le tue entrate, le tue spese ricorrenti e quello che vuoi mettere da parte.",
          captionLead: "Il tuo mese tipo: su 3.500 ",
          captionTail:
            " di entrate, 1.600 di spese ricorrenti e 500 di risparmio lasciano 1.400 disponibili ogni mese",
        },
        year: {
          title: "Colloca quello che cambia",
          description:
            "Aggiungi le tasse, le vacanze e gli acquisti importanti nei mesi in cui avverranno.",
          captionLead: "Il tuo anno: dodici mesi a 1.400 ",
          captionTail:
            " disponibili, tranne luglio a 500 per le tasse, agosto a 700 per le vacanze e dicembre a 200 per un acquisto importante",
        },
        month: {
          title: "Vedi quanto ti resterà",
          description:
            "Apri un mese futuro per vedere il tuo disponibile, poi correggi il budget se serve.",
          captionLead: "Luglio: su 3.500 ",
          captionTail:
            " di entrate, 1.600 di ricorrente, 500 di risparmio e 900 di tasse lasciano 500 disponibili",
        },
      },
      visuals: {
        templateTitle: "Il tuo mese tipo",
        yearTitle: "Il tuo anno",
        monthTitle: "Luglio, in arrivo",
        income: "Entrate",
        recurring: "Ricorrente",
        saving: "Risparmio",
        tax: "Tasse",
        available: "Disponibile",
        templatePayoff: "Disponibile da spendere, ogni mese",
        monthPayoff: "Ti resterà a luglio",
        yearLegend:
          "Luglio, tasse · Agosto, vacanze · Dicembre, acquisto importante",
        monthInitials: [
          "G",
          "F",
          "M",
          "A",
          "M",
          "G",
          "L",
          "A",
          "S",
          "O",
          "N",
          "D",
        ],
      },
    },

    testimonials: {
      heading: "Perché usano Pulpe.",
      items: [
        {
          lead: "Sono meno stressato. Ho una visione d’insieme, e ",
          highlight: "le spese che non vedevo arrivare",
          tail: ", adesso le vedo arrivare.",
          name: "Ismaël S.",
          role: "Ingegnere informatico",
          since: "Utente da novembre 2025",
        },
        {
          lead: "Vedo subito ",
          highlight: "a che punto è il mio budget",
          tail: ". È comodo, chiaro e molto più semplice da seguire.",
          name: "Sylvie G.",
          since: "Utente da maggio 2026",
        },
        {
          lead: "Posso ",
          highlight: "pianificare le nostre vacanze sull’anno",
          tail: " e vedere subito se rientrano nel nostro budget. Mi tranquillizza.",
          name: "Julie D.",
          role: "Impiegata di commercio",
          since: "Utente da dicembre 2025",
        },
      ],
    },

    features: {
      headingLead: "Quando i tuoi piani cambiano, ",
      headingHighlight: "Pulpe ricalcola il resto.",
      spread: {
        title: "Ripartisci una spesa grossa su più mesi.",
        bodyEmphasis: "Il totale non cambia.",
        bodyTail:
          " Scegli i mesi, Pulpe calcola la quota di ciascuno e ti mostra quanto resta da mettere da parte.",
        mockLabel: "Assicurazione annuale",
        mockMonths: ["Mag", "Giu", "Lug", "Ago"],
      },
      goal: {
        title: "Avanza verso il tuo obiettivo, anche se un mese cambia.",
        body: "Fissa un traguardo e una data. Vedi i risparmi che vi contribuiscono e puoi ripartire il resto sui mesi successivi.",
        mockLabel: "Vacanze",
        mockDeadline: "Per settembre",
        mockRemaining: "Resto ripartito",
        mockMonths: ["Ago", "Set"],
      },
    },

    platforms: {
      heading: "Il tuo budget ti segue. Non il contrario.",
      intro:
        "Su iPhone o nel browser ritrovi lo stesso anno e le stesse cifre.",
      ios: {
        badge: "Disponibile",
        title: "Pulpe per iPhone",
        text: "Un’app nativa con notifiche, widget e Face ID, pensata per consultare e aggiornare il tuo budget ovunque.",
        storeAriaLabel: "Scarica Pulpe sull’App Store",
        storeBadgeAlt: "Scarica sull’App Store",
      },
      web: {
        title: "Nel tuo browser",
        text: "Apri Pulpe nel browser, su computer o cellulare. Niente da installare.",
        cta: "Apri l’app web",
      },
      android: {
        title: "Android",
        badge: "Presto",
        text: "L’app nativa è in lavorazione. La versione Web funziona già sui cellulari Android.",
      },
    },

    whyFree: {
      portraitAlt: "Maxime, il creatore di Pulpe",
      eyebrow: "Una nota dal creatore",
      heading: "Avevo bisogno di un budget che guardasse avanti.",
      paragraphs: [
        "Ho creato Pulpe dopo aver passato troppo tempo a tenere aggiornati i miei fogli di calcolo. Volevo sapere che cosa una decisione avrebbe cambiato nei mesi successivi, non solo capire dove erano finiti i miei soldi.",
        "Il progetto oggi è gratis, senza pubblicità né abbonamento. Il suo codice resta pubblico perché tu possa verificare come funziona.",
      ],
      signature: "Maxime, il creatore di Pulpe",
      sourceLink: "Vedi il codice sorgente",
      guarantees: {
        encryption: {
          title: "Importi protetti",
          text: "I tuoi importi non sono conservati in chiaro. Sono cifrati con AES-256-GCM grazie a due chiavi conservate separatamente.",
        },
        analytics: {
          title: "Misurazione d’uso in Europa",
          text: "I dati d’uso che servono a migliorare Pulpe sono trattati sui server europei di PostHog.",
        },
        openSource: {
          title: "Codice aperto",
          text: "Il codice sorgente è pubblico: puoi vedere come funziona Pulpe e come sono protetti i tuoi importi.",
        },
      },
    },

    faq: {
      heading: "Le domande che mi fanno più spesso.",
      items: [
        {
          question: "Perché Pulpe invece di Excel?",
          answer:
            "Excel fa il suo lavoro, ma le formule diventano fragili appena sposti una riga. E su cellulare è scomodo. Pulpe mantiene la visione d’insieme e ricalcola il resto quando correggi il budget.",
        },
        {
          question: "È davvero gratis?",
          answer:
            "Sì. Pulpe oggi è gratis, senza pubblicità né abbonamento. Il progetto è personale e il suo codice sorgente è pubblico.",
        },
        {
          question: "Recupero i miei dati se smetto?",
          answer:
            "Sì. Puoi esportare i tuoi budget dall’app. I tuoi dati non sono chiusi dentro Pulpe.",
        },
        {
          question: "I miei importi sono protetti?",
          answer:
            "Sì. I tuoi importi non sono mai conservati in chiaro. Sono cifrati nel database con AES-256-GCM. Vengono decifrati lato server durante le tue richieste autenticate grazie a due chiavi conservate separatamente, una delle quali derivata dal tuo codice PIN. Una fuga del solo database non basta quindi a leggerli. I tuoi importi e le tue etichette finanziarie non sono né ceduti a fini pubblicitari né rivenduti. Il codice sorgente è pubblico.",
        },
        {
          question: "Perché nessun collegamento con la mia banca?",
          answer:
            "Mi sarebbe piaciuto offrire una sincronizzazione bancaria. Per farlo bene in Svizzera e in Francia servono fornitori esterni e vincoli normativi. Per un progetto che sviluppo da solo, la sera dopo il lavoro, il costo è troppo alto. Quindi, per ora, l’inserimento resta manuale.",
        },
        {
          question: "Quanto tempo serve per cominciare?",
          answer:
            "Bastano pochi minuti: inserisci un mese abituale, aggiungi le spese una tantum che conosci, poi guarda la proiezione del tuo anno.",
        },
      ],
    },

    finalCta: {
      heading: "Prepara il tuo anno. Vedi quanto ti resterà ogni mese.",
      body: "Comincia gratis, senza collegare i tuoi conti bancari. I tuoi importi sono cifrati nel database e non sono mai rivenduti.",
      cta: "Crea il mio budget gratis",
      arrowNote: "Pronto a respirare?",
    },

    stickyCta: "Crea il mio budget gratis",
  },

  support: {
    metaTitle: "Aiuto e domande frequenti",
    metaDescription:
      "Tutorial e risposte per usare Pulpe: capire modelli e budget, proteggere i propri importi e gestire il proprio account.",
    heading: "Come posso aiutarti?",
    intro:
      "Tutorial brevi per usare Pulpe, poi le risposte alle domande frequenti. Se manca la tua, scrivimi.",
    guidesHeading: "Inizia con Pulpe.",
    guideCard: {
      eyebrow: "Tutorial",
      title: "Modello o budget: che cosa devi modificare?",
      text: "Scegli il posto giusto a seconda che il tuo cambiamento riguardi un solo mese o i tuoi mesi abituali.",
    },
    faqHeading: "Le domande che mi fanno più spesso.",
    faq: {
      purpose: {
        question: "A che cosa serve Pulpe, concretamente?",
        answer:
          "Imposti il tuo anno una volta, poi lo correggi via via. Se sposti una spesa, dirotti del risparmio o rimandi un progetto, vedi che cosa cambia sui mesi successivi senza ricominciare da zero.",
      },
      excel: {
        question: "Perché Pulpe invece di Excel?",
        answer:
          "Excel fa il suo lavoro, ma le formule diventano fragili appena sposti una riga. E su cellulare è scomodo. Pulpe mantiene la visione d’insieme e ricalcola il resto quando correggi il budget.",
      },
      bank: {
        question: "Perché Pulpe non si collega alla mia banca?",
        answer:
          "Mi sarebbe piaciuto offrire una sincronizzazione bancaria. Per farlo bene in Svizzera e in Francia servono fornitori esterni e vincoli normativi. Per un progetto che sviluppo da solo, la sera dopo il lavoro, il costo è troppo alto. Quindi, per ora, l’inserimento resta manuale.",
      },
      trust: {
        question: "Perché affidare le mie cifre a Pulpe?",
        answerBefore:
          "I tuoi importi non sono mai conservati in chiaro. Sono cifrati nel database con AES-256-GCM. Vengono decifrati lato server durante le tue richieste autenticate grazie a due chiavi conservate separatamente, una delle quali derivata dal tuo codice PIN. Una fuga del solo database non basta quindi a leggerli. I tuoi importi e le tue etichette finanziarie non sono né ceduti a fini pubblicitari né rivenduti. Il ",
        answerLink: "codice sorgente è pubblico",
        answerAfter:
          ", puoi verificare come funziona invece di credermi sulla parola.",
      },
      demo: {
        question: "Posso provarlo senza creare un account?",
        answerBefore: "Sì. La ",
        answerLink: "modalità demo",
        answerAfter:
          " ti lascia usare Pulpe senza account e senza inserire le tue cifre.",
      },
      free: {
        question: "È davvero gratis?",
        answerBefore:
          "Sì. Pulpe è gratis, senza pubblicità né abbonamento. È un progetto di una sola persona e il suo ",
        answerLink: "codice sorgente è pubblico",
        answerAfter: ".",
      },
      countries: {
        question: "Funziona in Svizzera e in Francia?",
        answer:
          "Sì. Pulpe funziona con i franchi svizzeri e gli euro, sul web e su iPhone.",
      },
      sync: {
        question: "Come ritrovo i miei budget tra il web e l’iPhone?",
        answer:
          "Accedi con lo stesso account su entrambi. I tuoi budget e le tue modifiche sono sincronizzati automaticamente.",
      },
      deletion: {
        question: "Come cancello il mio account e i miei dati?",
        answerBefore: "Puoi chiedere la cancellazione dalle ",
        answerLink: "impostazioni",
        answerAfter:
          ". L’account e i tuoi dati sono allora programmati per essere cancellati entro tre giorni, il che ti lascia questo margine per cambiare idea. Passato quel termine, sono rimossi dai sistemi attivi. Delle copie possono restare temporaneamente nei backup tecnici, poi scadono secondo la politica di conservazione del fornitore di hosting.",
      },
    },
    contactHeading: "La tua domanda non c’è?",
    contactText:
      "Scrivimi direttamente. Sviluppo Pulpe da solo e rispondo di persona.",
    contactGithub: "Bug o suggerimento su GitHub",
  },

  guide: {
    metaTitle: "Modello o budget: che cosa devi modificare?",
    metaDescription:
      "Capire la differenza tra un modello e un budget mensile in Pulpe, poi sapere quale modificare su iPhone.",
    backToSupport: "Aiuto",
    eyebrow: "Modelli e budget",
    heading: "Modello o budget: che cosa devi modificare?",
    intro:
      "Il modello prepara i tuoi mesi abituali. Un budget rappresenta un mese preciso.",
    differenceHeading: "La differenza in una frase.",
    template: {
      eyebrow: "Il modello",
      title: "La tua base di partenza",
      text: "Contiene le tue entrate, spese e risparmi abituali. Serve a preparare i tuoi budget mensili senza reinserire tutto.",
    },
    budget: {
      eyebrow: "Il budget",
      title: "Un mese preciso",
      text: "Corrisponde per esempio ad agosto 2026. Puoi correggerlo per quel mese senza cambiare la tua base abituale.",
    },
    choiceHeading: "Scegli in base a quello che vuoi cambiare.",
    choices: [
      {
        intent: "Cambiare solo questo mese",
        destination: "Il budget del mese",
      },
      { intent: "Cambiare i miei mesi abituali", destination: "Il modello" },
      { intent: "Creare il mese prossimo", destination: "Un nuovo budget" },
      {
        intent: "Creare un’altra base riutilizzabile",
        destination: "Un nuovo modello",
      },
    ],
    iphoneEyebrow: "Su iPhone",
    iphoneHeading: "I due percorsi, passo dopo passo.",
    budgetSteps: {
      eyebrow: "Un solo mese",
      title: "Modificare un budget mensile",
      steps: [
        "Apri la scheda «Budget».",
        "Tocca + per creare il budget del mese prossimo, oppure apri un mese esistente.",
        "Nel budget, tocca + per aggiungere una previsione.",
        "Tocca una previsione esistente per modificarla o eliminarla.",
      ],
    },
    modelSteps: {
      eyebrow: "I tuoi mesi abituali",
      title: "Modificare il modello",
      steps: [
        "Apri la scheda «Modelli».",
        "Tocca + per creare una nuova base, oppure apri un modello esistente.",
        "Tocca una previsione esistente per modificarla.",
        "Scegli «Applica» per riportare la modifica sui budget in corso e futuri.",
      ],
    },
    protectedTitle: "Le tue correzioni restano protette",
    protectedParagraphs: [
      "Quando scegli «Applica», Pulpe aggiorna i budget in corso e futuri. Una previsione già modificata a mano dentro un budget non viene sostituita.",
      "Su iPhone puoi creare un modello e modificarne le previsioni. Per aggiungere o eliminare una previsione in un modello già creato, usa per ora la versione web.",
    ],
    contactHeading: "Ancora bloccato?",
    contactText:
      "Scrivimi indicando la schermata in cui ti trovi. Ti risponderò direttamente.",
  },

  changelog: {
    metaTitle: "Novità",
    metaDescription:
      "Tutte le novità e le correzioni di Pulpe. Segui gli aggiornamenti dell’app web, iOS e Android.",
    heading: "Novità",
    intro: "Gli ultimi aggiornamenti di Pulpe.",
    sections: {
      features: "Novità",
      fixes: "Correzioni",
      technical: "Tecnico",
    },
    githubRelease: "GitHub Release",
    frenchArchive: "Consulta l’archivio completo in francese",
  },

  notFound: {
    title: "Questa pagina non esiste",
    text: "L’app Pulpe ha traslocato. Puoi raggiungerla direttamente sul suo nuovo dominio.",
    appCta: "Vai all’app",
    homeCta: "Torna alla pagina iniziale",
  },

  language: {
    switcherLabel: "Lingua",
  },
};

export default it;
