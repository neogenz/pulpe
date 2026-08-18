import type { Dictionary } from "../dictionary";

// Deutsch duzt durchgehend, nie „Sie“. Anführungszeichen sind deutsche
// („…“), kein französisches schmales Leerzeichen vor `?`. Deutsch läuft 30 bis
// 40 % länger als Französisch: Navigation, Buttons und Badges nehmen deshalb
// die Kurzform. Produktbegriffe folgen dem Lexikon in `docs/I18N.md`.
const de: Dictionary = {
  site: {
    titleDefault: "Pulpe – Budget-App | Plane dein Jahr, sieh, was dir bleibt",
    titleTemplate: "%s | Pulpe",
    description:
      "Eine Budget-App, um Einnahmen, Ausgaben und Sparen zu planen. Pulpe zeigt dir, was dir jeden Monat bleibt — ohne Bankverbindung.",
    socialImageAlt:
      "Pulpe projiziert dein Budget über das Jahr und zeigt, was dir bleibt",
    graphDescription:
      "Pulpe ist eine Budget-App, um dein Jahr zu planen — ohne Bankverbindung.",
    featureList: [
      "Jahresplanung",
      "Verfügbar zum Ausgeben jeden Monat",
      "Ohne Bankverbindung",
    ],
    socialCard: {
      subhead: "Plane dein Jahr. Sieh jeden Monat, was dir bleibt.",
      badge: "Kostenlos · Ohne Bankverbindung",
    },
  },

  common: {
    skipToContent: "Zum Inhalt springen",
  },

  header: {
    navAriaLabel: "Hauptnavigation",
    mobileNavAriaLabel: "Mobile Navigation",
    menuLabel: "Menü",
    homeAriaLabel: "Pulpe, Startseite",
    cta: "Budget erstellen",
    nav: {
      painPoints: "Warum Pulpe",
      howItWorks: "So funktioniert’s",
      platforms: "Apps",
      support: "Hilfe",
      whyFree: "Warum gratis",
    },
  },

  footer: {
    tagline: "Das Budget, das nach vorne schaut. In der Schweiz entwickelt.",
    navAriaLabel: "Nützliche Links",
    groups: {
      discover: "Entdecken",
      help: "Hilfe",
      legal: "Rechtliches",
    },
    links: {
      source: "Quellcode",
      terms: "Bedingungen",
      privacy: "Datenschutz",
      changelog: "Neuigkeiten",
      support: "FAQ und Anleitungen",
      contact: "Kontakt",
    },
  },

  home: {
    hero: {
      headlineLead: "Du weisst Monate im Voraus, ",
      headlineHighlight: "was dir bleibt.",
      subheadLead: "Plane dein Budget ",
      subheadEmphasis: "übers ganze Jahr",
      subheadTail:
        ". Du siehst, was dir jeden Monat bleibt, und bereitest deine Vorhaben gelassener vor.",
      cta: "Budget gratis erstellen",
      reassurance: "Gratis · Verschlüsselte Beträge · Keine Bankverbindung",
    },

    dashboard: {
      caption: "Vorschau auf das Pulpe-Dashboard",
      title: "Dashboard",
      scope: "Jahresansicht",
      currentMonth: "Aktueller Monat",
      available: "Verfügbar diesen Monat",
      spent: "Ausgegeben",
      outOf: "von",
      note: "Deine grossen Ausgaben stecken schon in den kommenden Monaten.",
      previsionsTitle: "Planung des Monats",
      previsions: {
        rent: "Miete",
        insurance: "Versicherung",
        electricity: "Strom",
      },
      projectionTitle: "Saldo-Prognose",
      projectionHint: "Du siehst es kommen",
      projectionAriaLabel: "Saldo-Prognose steigt über das Jahr",
    },

    painPoints: {
      heading:
        "Die Steuern kommen im Juli. Du weisst jetzt schon, was dir im August bleibt.",
      intro:
        "Eine grosse Ausgabe fällt in einem Monat an, wirkt aber weit darüber hinaus. Mit einer Tabelle rechnest du den Rest selbst nach. Eine Tracking-App zeigt sie erst, wenn sie bezahlt ist.",
      spreadsheet: {
        title: "Mit einer Tabelle musst du alles aktuell halten.",
        text: "Bei jeder Änderung passt du Zeilen, Monate und manchmal Formeln an. Ist deine Datei nicht mehr aktuell, ist es deine Prognose auch nicht.",
      },
      tracking: {
        title: "Tracking beginnt, wenn das Geld ausgegeben ist.",
        text: "Eine Tracking-App erklärt dir, wohin dein Geld geflossen ist. Weniger hilft sie dir bei der Frage, ob eine für September geplante Ausgabe noch in dein Budget passt.",
      },
    },

    solution: {
      headingLead: "Starte mit einem typischen Monat. ",
      headingHighlight: "Pulpe rechnet den Rest hoch.",
      intro:
        "Du startest mit einem gewöhnlichen Monat. Pulpe bereitet damit die folgenden vor. Danach setzt du Steuern, Ferien und grosse Anschaffungen in die Monate, in die sie gehören.",
    },

    howItWorks: {
      steps: {
        template: {
          title: "Trage einen gewöhnlichen Monat ein",
          description:
            "Ergänze deine Einnahmen, deine wiederkehrenden Ausgaben und das, was du zurücklegen willst.",
          captionLead: "Dein typischer Monat: von 3’500 ",
          captionTail:
            " Einnahmen bleiben nach 1’600 wiederkehrenden Ausgaben und 500 Sparen jeden Monat 1’400 verfügbar",
        },
        year: {
          title: "Setze ein, was sich ändert",
          description:
            "Trage Steuern, Ferien und grosse Anschaffungen in den Monaten ein, in denen sie anfallen.",
          captionLead: "Dein Jahr: zwölf Monate mit 1’400 ",
          captionTail:
            " verfügbar, ausser Juli mit 500 für die Steuern, August mit 700 für die Ferien und Dezember mit 200 für eine grosse Anschaffung",
        },
        month: {
          title: "Sieh, was dir bleibt",
          description:
            "Öffne einen kommenden Monat, um dein Verfügbares zu sehen, und passe dein Budget bei Bedarf an.",
          captionLead: "Juli: von 3’500 ",
          captionTail:
            " Einnahmen bleiben nach 1’600 wiederkehrend, 500 Sparen und 900 Steuern 500 verfügbar",
        },
      },
      visuals: {
        templateTitle: "Dein typischer Monat",
        yearTitle: "Dein Jahr",
        monthTitle: "Juli, kommend",
        income: "Einnahmen",
        recurring: "Wiederkehrend",
        saving: "Sparen",
        tax: "Steuern",
        available: "Verfügbar",
        templatePayoff: "Verfügbar zum Ausgeben, jeden Monat",
        monthPayoff: "Bleibt dir im Juli",
        yearLegend:
          "Juli, Steuern · August, Ferien · Dezember, grosse Anschaffung",
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
      heading: "Warum sie Pulpe nutzen.",
      items: [
        {
          lead: "Ich bin entspannter. Ich habe den Überblick, und ",
          highlight: "die Ausgaben, die ich nie kommen sah",
          tail: ", sehe ich jetzt kommen.",
          name: "Ismaël S.",
          role: "Software-Ingenieur",
          since: "Nutzer seit November 2025",
        },
        {
          lead: "Ich sehe sofort, ",
          highlight: "wo mein Budget steht",
          tail: ". Das ist praktisch, klar und viel einfacher zu verfolgen.",
          name: "Sylvie G.",
          since: "Nutzerin seit Mai 2026",
        },
        {
          lead: "Ich kann ",
          highlight: "unsere Ferien übers Jahr planen",
          tail: " und sehe sofort, ob sie in unser Budget passen. Das beruhigt mich.",
          name: "Julie D.",
          role: "Kauffrau",
          since: "Nutzerin seit Dezember 2025",
        },
      ],
    },

    features: {
      headingLead: "Wenn sich deine Pläne ändern, ",
      headingHighlight: "rechnet Pulpe den Rest neu.",
      spread: {
        title: "Verteile eine grosse Ausgabe auf mehrere Monate.",
        bodyEmphasis: "Die Summe bleibt gleich.",
        bodyTail:
          " Du wählst die Monate, Pulpe berechnet jeden Anteil und zeigt dir, was noch zurückzulegen ist.",
        mockLabel: "Jahresversicherung",
        mockMonths: ["Mai", "Juni", "Juli", "Aug."],
      },
      goal: {
        title: "Komm deinem Ziel näher, auch wenn ein Monat kippt.",
        body: "Lege ein Ziel und ein Datum fest. Du siehst, welches Sparen dazu beiträgt, und kannst den Rest auf die folgenden Monate verteilen.",
        mockLabel: "Ferien",
        mockDeadline: "Für September",
        mockRemaining: "Rest verteilt",
        mockMonths: ["Aug.", "Sept."],
      },
    },

    platforms: {
      heading: "Dein Budget folgt dir. Nicht umgekehrt.",
      intro:
        "Auf dem iPhone oder im Browser findest du dasselbe Jahr und dieselben Zahlen.",
      ios: {
        badge: "Verfügbar",
        title: "Pulpe für iPhone",
        text: "Eine native App mit Mitteilungen, Widgets und Face ID, gebaut, um dein Budget überall anzusehen und zu aktualisieren.",
        storeAriaLabel: "Pulpe im App Store laden",
        storeBadgeAlt: "Laden im App Store",
      },
      web: {
        title: "In deinem Browser",
        text: "Öffne Pulpe im Browser, am Computer oder auf dem Handy. Nichts zu installieren.",
        cta: "Web-App öffnen",
      },
      android: {
        title: "Android",
        badge: "Bald",
        text: "Die native App entsteht gerade. Die Web-Version läuft auf Android-Handys bereits.",
      },
    },

    whyFree: {
      portraitAlt: "Maxime, der Entwickler von Pulpe",
      eyebrow: "Eine Notiz vom Entwickler",
      heading: "Ich brauchte ein Budget, das nach vorne schaut.",
      paragraphs: [
        "Ich habe Pulpe gebaut, nachdem ich viel zu viel Zeit damit verbracht hatte, meine Tabellen aktuell zu halten. Ich wollte wissen, was eine Entscheidung in den folgenden Monaten ändert — nicht nur verstehen, wohin mein Geld geflossen war.",
        "Das Projekt ist heute gratis, ohne Werbung und ohne Abo. Sein Code bleibt öffentlich, damit du nachprüfen kannst, wie er arbeitet.",
      ],
      signature: "Maxime, der Entwickler von Pulpe",
      sourceLink: "Quellcode ansehen",
      guarantees: {
        encryption: {
          title: "Geschützte Beträge",
          text: "Deine Beträge werden nicht im Klartext gespeichert, sondern mit AES-256-GCM verschlüsselt, mit zwei getrennt aufbewahrten Schlüsseln.",
        },
        analytics: {
          title: "Nutzungsmessung in Europa",
          text: "Die Nutzungsdaten, die Pulpe verbessern helfen, werden auf den europäischen Servern von PostHog verarbeitet.",
        },
        openSource: {
          title: "Offener Code",
          text: "Der Quellcode ist öffentlich: Du kannst sehen, wie Pulpe arbeitet und wie deine Beträge geschützt sind.",
        },
      },
    },

    faq: {
      heading: "Die Fragen, die mir am häufigsten gestellt werden.",
      items: [
        {
          question: "Ist Pulpe eine Budget-App?",
          answer:
            "Ja. So suchen die Leute danach. Pulpe dient vor allem der Jahresplanung: Du siehst, was dir jeden Monat bleibt, statt nur zu erfassen, was schon ausgegeben ist.",
        },
        {
          question: "Warum Pulpe statt Excel?",
          answer:
            "Excel erledigt die Aufgabe, aber die Formeln werden schnell brüchig, sobald du eine Zeile verschiebst. Und auf dem Handy ist es mühsam. Pulpe behält den Überblick und rechnet den Rest neu, wenn du dein Budget anpasst.",
        },
        {
          question: "Ist es wirklich gratis?",
          answer:
            "Ja. Pulpe ist heute gratis, ohne Werbung und ohne Abo. Das Projekt ist privat und sein Quellcode ist öffentlich.",
        },
        {
          question: "Bekomme ich meine Daten zurück, wenn ich aufhöre?",
          answer:
            "Ja. Du kannst deine Budgets aus der App exportieren. Deine Daten sind nicht in Pulpe eingeschlossen.",
        },
        {
          question: "Sind meine Beträge geschützt?",
          answer:
            "Ja. Deine Beträge werden nie im Klartext gespeichert: In der Datenbank sind sie mit AES-256-GCM verschlüsselt. Entschlüsselt werden sie serverseitig während deiner authentifizierten Anfragen, mit zwei getrennt aufbewahrten Schlüsseln, von denen einer aus deinem PIN abgeleitet ist. Ein Leck der Datenbank allein genügt also nicht, um sie zu lesen. Deine finanziellen Beträge und Bezeichnungen werden weder für Werbung weitergegeben noch verkauft. Der Quellcode ist öffentlich.",
        },
        {
          question: "Warum keine Verbindung zu meiner Bank?",
          answer:
            "Ich hätte gerne eine Bankensynchronisation angeboten. Um das in der Schweiz und in Frankreich sauber zu machen, braucht es externe Anbieter und regulatorische Auflagen. Für ein Projekt, das ich allein abends nach der Arbeit baue, ist der Aufwand zu hoch. Die Eingabe bleibt daher vorerst manuell.",
        },
        {
          question: "Wie lange dauert der Einstieg?",
          answer:
            "Ein paar Minuten genügen: Trage einen gewöhnlichen Monat ein, ergänze die einmaligen Ausgaben, die du kennst, und sieh dir dann die Prognose für dein Jahr an.",
        },
      ],
    },

    finalCta: {
      heading: "Bereite dein Jahr vor. Sieh, was dir jeden Monat bleibt.",
      body: "Starte gratis, ohne deine Bankkonten zu verbinden. Deine Beträge sind in der Datenbank verschlüsselt und werden nie verkauft.",
      cta: "Budget gratis erstellen",
      arrowNote: "Bereit durchzuatmen?",
    },

    stickyCta: "Budget gratis erstellen",
  },

  support: {
    metaTitle: "Hilfe und häufige Fragen",
    metaDescription:
      "Anleitungen und Antworten rund um Pulpe: Vorlagen und Budgets verstehen, Beträge schützen und das Konto verwalten.",
    heading: "Wie kann ich dir helfen?",
    intro:
      "Kurze Anleitungen für Pulpe, danach die Antworten auf die häufigsten Fragen. Fehlt deine, schreib mir.",
    guidesHeading: "Erste Schritte mit Pulpe.",
    guideCard: {
      eyebrow: "Anleitung",
      title: "Vorlage oder Budget: Was musst du ändern?",
      text: "Wähle die richtige Stelle, je nachdem ob deine Änderung einen einzelnen Monat oder deine gewöhnlichen Monate betrifft.",
    },
    faqHeading: "Die Fragen, die mir am häufigsten gestellt werden.",
    faq: {
      purpose: {
        question: "Wozu dient Pulpe konkret?",
        answer:
          "Du legst dein Jahr einmal an und passt es danach laufend an. Wenn du eine Ausgabe verschiebst, Sparen umleitest oder ein Vorhaben vertagst, siehst du, was das an den folgenden Monaten ändert — ohne von vorne zu beginnen.",
      },
      excel: {
        question: "Warum Pulpe statt Excel?",
        answer:
          "Excel erledigt die Aufgabe, aber die Formeln werden schnell brüchig, sobald du eine Zeile verschiebst. Und auf dem Handy ist es mühsam. Pulpe behält den Überblick und rechnet den Rest neu, wenn du dein Budget anpasst.",
      },
      bank: {
        question: "Warum verbindet sich Pulpe nicht mit meiner Bank?",
        answer:
          "Ich hätte gerne eine Bankensynchronisation angeboten. Um das in der Schweiz und in Frankreich sauber zu machen, braucht es externe Anbieter und regulatorische Auflagen. Für ein Projekt, das ich allein abends nach der Arbeit baue, ist der Aufwand zu hoch. Die Eingabe bleibt daher vorerst manuell.",
      },
      trust: {
        question: "Warum sollte ich Pulpe meine Zahlen anvertrauen?",
        answerBefore:
          "Deine Beträge werden nie im Klartext gespeichert: In der Datenbank sind sie mit AES-256-GCM verschlüsselt. Entschlüsselt werden sie serverseitig während deiner authentifizierten Anfragen, mit zwei getrennt aufbewahrten Schlüsseln, von denen einer aus deinem PIN abgeleitet ist. Ein Leck der Datenbank allein genügt also nicht, um sie zu lesen. Deine finanziellen Beträge und Bezeichnungen werden weder für Werbung weitergegeben noch verkauft. Der ",
        answerLink: "Quellcode ist öffentlich",
        answerAfter:
          ", du kannst nachprüfen, wie er arbeitet, statt mir aufs Wort zu glauben.",
      },
      demo: {
        question: "Kann ich es ohne Konto ausprobieren?",
        answerBefore: "Ja. Der ",
        answerLink: "Demo-Modus",
        answerAfter:
          " lässt dich Pulpe ohne Konto nutzen, ohne eigene Zahlen einzugeben.",
      },
      free: {
        question: "Ist es wirklich gratis?",
        answerBefore:
          "Ja. Pulpe ist gratis, ohne Werbung und ohne Abo. Es ist ein Ein-Personen-Projekt und sein ",
        answerLink: "Quellcode ist öffentlich",
        answerAfter: ".",
      },
      countries: {
        question: "Funktioniert es in der Schweiz und in Frankreich?",
        answer:
          "Ja. Pulpe arbeitet mit Schweizer Franken und Euro, im Web und auf dem iPhone.",
      },
      sync: {
        question:
          "Wie finde ich meine Budgets im Web und auf dem iPhone wieder?",
        answer:
          "Melde dich auf beiden mit demselben Konto an. Deine Budgets und deine Änderungen werden automatisch synchronisiert.",
      },
      deletion: {
        question: "Wie lösche ich mein Konto und meine Daten?",
        answerBefore: "Du kannst die Löschung in den ",
        answerLink: "Einstellungen",
        answerAfter:
          " beantragen. Konto und Daten werden dann zur Löschung in drei Tagen vorgemerkt, was dir diese Frist lässt, es dir anders zu überlegen. Danach werden sie aus den aktiven Systemen entfernt. Kopien können vorübergehend in technischen Sicherungen bestehen bleiben und verfallen dann gemäss der Aufbewahrungsfrist des Hosting-Anbieters.",
      },
    },
    contactHeading: "Deine Frage ist nicht dabei?",
    contactText:
      "Schreib mir direkt. Ich entwickle Pulpe allein und antworte selbst.",
    contactGithub: "Fehler oder Vorschlag auf GitHub",
  },

  guide: {
    metaTitle: "Vorlage oder Budget: Was musst du ändern?",
    metaDescription:
      "Den Unterschied zwischen einer Vorlage und einem Monatsbudget in Pulpe verstehen — und wissen, was du auf dem iPhone änderst.",
    backToSupport: "Hilfe",
    eyebrow: "Vorlagen und Budgets",
    heading: "Vorlage oder Budget: Was musst du ändern?",
    intro:
      "Die Vorlage bereitet deine gewöhnlichen Monate vor. Ein Budget steht für einen bestimmten Monat.",
    differenceHeading: "Der Unterschied in einem Satz.",
    template: {
      eyebrow: "Die Vorlage",
      title: "Dein Ausgangspunkt",
      text: "Darin stehen deine gewöhnlichen Einnahmen, Ausgaben und dein Sparen. So bereitet sie deine Monatsbudgets vor, ohne dass du alles neu erfassen musst.",
    },
    budget: {
      eyebrow: "Das Budget",
      title: "Ein bestimmter Monat",
      text: "Es entspricht zum Beispiel dem August 2026. Du kannst es für diesen Monat anpassen, ohne deinen gewöhnlichen Ausgangspunkt zu ändern.",
    },
    choiceHeading: "Wähle nach dem, was du ändern willst.",
    choices: [
      { intent: "Nur diesen Monat ändern", destination: "Das Monatsbudget" },
      {
        intent: "Meine gewöhnlichen Monate ändern",
        destination: "Die Vorlage",
      },
      { intent: "Den nächsten Monat anlegen", destination: "Ein neues Budget" },
      {
        intent: "Einen weiteren wiederverwendbaren Ausgangspunkt anlegen",
        destination: "Eine neue Vorlage",
      },
    ],
    iphoneEyebrow: "Auf dem iPhone",
    iphoneHeading: "Beide Wege, Schritt für Schritt.",
    budgetSteps: {
      eyebrow: "Ein einzelner Monat",
      title: "Ein Monatsbudget ändern",
      steps: [
        "Öffne den Tab „Budgets“.",
        "Tippe auf +, um das Budget des nächsten Monats anzulegen, oder öffne einen bestehenden Monat.",
        "Tippe im Budget auf +, um einen Planposten hinzuzufügen.",
        "Tippe einen bestehenden Planposten an, um ihn zu ändern oder zu löschen.",
      ],
    },
    modelSteps: {
      eyebrow: "Deine gewöhnlichen Monate",
      title: "Die Vorlage ändern",
      steps: [
        "Öffne den Tab „Vorlagen“.",
        "Tippe auf +, um einen neuen Ausgangspunkt anzulegen, oder öffne eine bestehende Vorlage.",
        "Tippe einen bestehenden Planposten an, um ihn zu ändern.",
        "Wähle „Anwenden“, um die Änderung auf laufende und künftige Budgets zu übertragen.",
      ],
    },
    protectedTitle: "Deine Anpassungen bleiben geschützt",
    protectedParagraphs: [
      "Wenn du „Anwenden“ wählst, aktualisiert Pulpe die laufenden und künftigen Budgets. Ein Planposten, den du in einem Budget bereits von Hand geändert hast, wird nicht überschrieben.",
      "Auf dem iPhone kannst du eine Vorlage anlegen und ihre Planposten ändern. Um in einer bereits angelegten Vorlage einen Planposten hinzuzufügen oder zu löschen, nutze vorerst die Web-Version.",
    ],
    contactHeading: "Immer noch blockiert?",
    contactText:
      "Schreib mir und nenne den Bildschirm, auf dem du bist. Ich antworte dir direkt.",
  },

  changelog: {
    metaTitle: "Neuigkeiten",
    metaDescription:
      "Alle Neuerungen und Korrekturen von Pulpe. Verfolge die Updates der Web-, iOS- und Android-App.",
    heading: "Neuigkeiten",
    intro: "Die letzten Updates von Pulpe.",
    sections: {
      features: "Neu",
      fixes: "Korrekturen",
      technical: "Technisch",
    },
    githubRelease: "GitHub Release",
    frenchArchive: "Vollständiges Archiv auf Französisch ansehen",
  },

  notFound: {
    title: "Diese Seite gibt es nicht",
    text: "Die Pulpe-App ist umgezogen. Du erreichst sie direkt unter ihrer neuen Adresse.",
    appCta: "Zur App",
    homeCta: "Zurück zur Startseite",
  },

  language: {
    switcherLabel: "Sprache",
  },
};

export default de;
