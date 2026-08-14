import type { Dictionary } from "../dictionary";

// English keeps the direct second person of the French source, with no added
// politeness formula. No narrow no-break space before `?` — that is French
// typography only. Product terms follow the arrested lexicon in `docs/I18N.md`.
const en: Dictionary = {
  site: {
    titleDefault: "Pulpe | Know months ahead what you’ll have left",
    titleTemplate: "%s | Pulpe",
    description:
      "Plan your income, your expenses and your savings. Pulpe shows you what you’ll have left each month, with no bank connection.",
    socialImageAlt:
      "Pulpe projects your budget across the year and shows what you’ll have left",
    graphDescription:
      "Pulpe works out what you have available month after month from your income, your expenses and your savings, with no bank connection.",
    socialCard: {
      subhead: "Plan your year. See what you have left every month.",
      badge: "Free · No bank connection",
    },
  },

  common: {
    skipToContent: "Skip to content",
  },

  header: {
    navAriaLabel: "Main navigation",
    mobileNavAriaLabel: "Mobile navigation",
    menuLabel: "Menu",
    homeAriaLabel: "Pulpe, home",
    cta: "Create my budget",
    nav: {
      painPoints: "Why Pulpe",
      howItWorks: "How it works",
      platforms: "Apps",
      support: "Help",
      whyFree: "Why it’s free",
    },
  },

  footer: {
    tagline: "The budget that looks at the months ahead. Built in Switzerland.",
    navAriaLabel: "Useful links",
    groups: {
      discover: "Discover",
      help: "Help",
      legal: "Legal",
    },
    links: {
      source: "Source code",
      terms: "Terms",
      privacy: "Privacy",
      changelog: "What’s new",
      support: "FAQ and tutorials",
      contact: "Contact",
    },
  },

  home: {
    hero: {
      headlineLead: "You know months ahead ",
      headlineHighlight: "what you’ll have left.",
      subheadLead: "Plan your budget ",
      subheadEmphasis: "across the year",
      subheadTail:
        ". You see what you’ll have left each month, so you can prepare your plans with a clearer head.",
      cta: "Create my budget for free",
      reassurance: "Free · Encrypted amounts · No bank connection",
    },

    dashboard: {
      caption: "Preview of the Pulpe dashboard",
      title: "Dashboard",
      scope: "Year view",
      currentMonth: "Current month",
      available: "Available this month",
      spent: "Spent",
      outOf: "of",
      note: "Your big expenses are already built into the months ahead.",
      previsionsTitle: "Planned this month",
      previsions: {
        rent: "Rent",
        insurance: "Insurance",
        electricity: "Electricity",
      },
      projectionTitle: "Balance projection",
      projectionHint: "You see it coming",
      projectionAriaLabel: "Balance projection rising across the year",
    },

    painPoints: {
      heading:
        "Taxes land in July. You already know what you’ll have left in August.",
      intro:
        "A big expense lands in one month, but you feel it well beyond. With a spreadsheet, you have to recalculate what follows. A tracking app only shows it once it’s paid.",
      spreadsheet: {
        title: "With a spreadsheet, you have to keep everything up to date.",
        text: "At the slightest change you edit the rows, the months and sometimes the formulas. If your file is out of date, so is your projection.",
      },
      tracking: {
        title: "Tracking starts once the money is spent.",
        text: "A tracking app explains where your money went. It helps you less to know whether an expense planned for September still fits your budget.",
      },
    },

    solution: {
      headingLead: "Start from a typical month. ",
      headingHighlight: "Pulpe projects the rest.",
      intro:
        "You start from an ordinary month. Pulpe uses it to prepare the ones that follow. Then you drop taxes, holidays and big purchases into the months they belong to.",
    },

    howItWorks: {
      steps: {
        template: {
          title: "Fill in an ordinary month",
          description:
            "Add your income, your recurring expenses and what you want to set aside.",
          captionLead: "Your typical month: out of 3,500 ",
          captionTail:
            " of income, 1,600 of recurring expenses and 500 of savings leave 1,400 available every month",
        },
        year: {
          title: "Place what changes",
          description:
            "Add taxes, holidays and big purchases in the months when they will happen.",
          captionLead: "Your year: twelve months at 1,400 ",
          captionTail:
            " available, except July at 500 for taxes, August at 700 for holidays and December at 200 for a big purchase",
        },
        month: {
          title: "See what you’ll have left",
          description:
            "Open a month ahead to see what’s available, then adjust your budget if you need to.",
          captionLead: "July: out of 3,500 ",
          captionTail:
            " of income, 1,600 recurring, 500 of savings and 900 of taxes leave 500 available",
        },
      },
      visuals: {
        templateTitle: "Your typical month",
        yearTitle: "Your year",
        monthTitle: "July, ahead",
        income: "Income",
        recurring: "Recurring",
        saving: "Savings",
        tax: "Taxes",
        available: "Available",
        templatePayoff: "Available to spend, every month",
        monthPayoff: "You’ll have left in July",
        yearLegend: "July, taxes · August, holidays · December, big purchase",
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
      heading: "Why they use Pulpe.",
      items: [
        {
          lead: "I stress less. I have the whole picture, and ",
          highlight: "the expenses I never saw coming",
          tail: ", I see them coming now.",
          name: "Ismaël S.",
          role: "Software engineer",
          since: "User since November 2025",
        },
        {
          lead: "I can see straight away ",
          highlight: "where my budget stands",
          tail: ". It’s handy, clear and far simpler to keep up with.",
          name: "Sylvie G.",
          since: "User since May 2026",
        },
        {
          lead: "I can ",
          highlight: "plan our holidays across the year",
          tail: " and see straight away whether they fit our budget. That reassures me.",
          name: "Julie D.",
          role: "Sales assistant",
          since: "User since December 2025",
        },
      ],
    },

    features: {
      headingLead: "When your plans change, ",
      headingHighlight: "Pulpe recalculates the rest.",
      spread: {
        title: "Spread a big expense over several months.",
        bodyEmphasis: "The total doesn’t change.",
        bodyTail:
          " You choose the months, Pulpe works out each share and shows you what’s left to set aside.",
        mockLabel: "Annual insurance",
        mockMonths: ["May", "Jun", "Jul", "Aug"],
      },
      goal: {
        title: "Keep moving towards your goal, even when a month changes.",
        body: "Set a target and a date. You see the savings that count towards it and can spread the rest over the following months.",
        mockLabel: "Holidays",
        mockDeadline: "For September",
        mockRemaining: "Rest spread",
        mockMonths: ["Aug", "Sep"],
      },
    },

    platforms: {
      heading: "Your budget follows you. Not the other way round.",
      intro:
        "On iPhone or in your browser, you find the same year and the same figures.",
      ios: {
        badge: "Available",
        title: "Pulpe for iPhone",
        text: "A native app with notifications, widgets and Face ID, built to check and update your budget anywhere.",
        storeAriaLabel: "Download Pulpe on the App Store",
        storeBadgeAlt: "Download on the App Store",
      },
      web: {
        title: "In your browser",
        text: "Open Pulpe in your browser, on desktop or mobile. Nothing to install.",
        cta: "Open the web app",
      },
      android: {
        title: "Android",
        badge: "Soon",
        text: "The native app is on its way. The web version already works on Android phones.",
      },
    },

    whyFree: {
      portraitAlt: "Maxime, the creator of Pulpe",
      eyebrow: "A note from the creator",
      heading: "I needed a budget that looks ahead.",
      paragraphs: [
        "I built Pulpe after spending far too long keeping my spreadsheets up to date. I wanted to know what a decision would change in the months that followed, not only to understand where my money had gone.",
        "The project is free today, with no ads and no subscription. Its code stays public so you can check how it works.",
      ],
      signature: "Maxime, the creator of Pulpe",
      sourceLink: "View the source code",
      guarantees: {
        encryption: {
          title: "Protected amounts",
          text: "Your amounts are not stored in the clear. They are encrypted with AES-256-GCM using two keys kept separately.",
        },
        analytics: {
          title: "Usage measurement in Europe",
          text: "The usage data that helps improve Pulpe is processed on PostHog’s European servers.",
        },
        openSource: {
          title: "Open code",
          text: "The source code is public: you can see how Pulpe works and how your amounts are protected.",
        },
      },
    },

    faq: {
      heading: "The questions I get asked most.",
      items: [
        {
          question: "Why Pulpe rather than Excel?",
          answer:
            "Excel does the job, but the formulas turn fragile as soon as you move a row. And on mobile it’s painful. Pulpe keeps the whole picture and recalculates what follows when you adjust your budget.",
        },
        {
          question: "Is it really free?",
          answer:
            "Yes. Pulpe is free today, with no ads and no subscription. The project is personal and its source code is public.",
        },
        {
          question: "Do I get my data back if I stop?",
          answer:
            "Yes. You can export your budgets from the app. Your data is not locked inside Pulpe.",
        },
        {
          question: "Are my amounts protected?",
          answer:
            "Yes. Your amounts are never stored in the clear. They are encrypted in the database with AES-256-GCM. They are decrypted server-side during your authenticated requests, using two keys kept separately, one of them derived from your PIN. A leak of the database alone is therefore not enough to read them. Your financial amounts and labels are neither shared for advertising nor sold. The source code is public.",
        },
        {
          question: "Why no connection to my bank?",
          answer:
            "I would have liked to offer bank synchronisation. Doing it properly in Switzerland and France means going through external providers and handling regulatory constraints. For a project I build alone, in the evening after work, the cost is too high. So for now, entry stays manual.",
        },
        {
          question: "How long does it take to get started?",
          answer:
            "A few minutes are enough: fill in an ordinary month, add the one-off expenses you know about, then look at the projection for your year.",
        },
      ],
    },

    finalCta: {
      heading: "Prepare your year. See what you’ll have left each month.",
      body: "Start for free, without connecting your bank accounts. Your amounts are encrypted in the database, and are never sold.",
      cta: "Create my budget for free",
      arrowNote: "Ready to breathe?",
    },

    stickyCta: "Create my budget for free",
  },

  support: {
    metaTitle: "Help and frequently asked questions",
    metaDescription:
      "Tutorials and answers for using Pulpe: understanding templates and budgets, protecting your amounts and managing your account.",
    heading: "How can I help?",
    intro:
      "Short tutorials for using Pulpe, then answers to the most frequent questions. If yours is missing, write to me.",
    guidesHeading: "Getting started with Pulpe.",
    guideCard: {
      eyebrow: "Tutorial",
      title: "Template or budget: which one should you edit?",
      text: "Pick the right place depending on whether your change affects a single month or your ordinary months.",
    },
    faqHeading: "The questions I get asked most.",
    faq: {
      purpose: {
        question: "What does Pulpe actually do?",
        answer:
          "You lay out your year once, then adjust as you go. If you move an expense, redirect some savings or push back a plan, you see what it changes in the following months without starting over.",
      },
      excel: {
        question: "Why Pulpe rather than Excel?",
        answer:
          "Excel does the job, but the formulas turn fragile as soon as you move a row. And on mobile it’s painful. Pulpe keeps the whole picture and recalculates what follows when you adjust your budget.",
      },
      bank: {
        question: "Why doesn’t Pulpe connect to my bank?",
        answer:
          "I would have liked to offer bank synchronisation. Doing it properly in Switzerland and France means going through external providers and handling regulatory constraints. For a project I build alone, in the evening after work, the cost is too high. So for now, entry stays manual.",
      },
      trust: {
        question: "Why trust Pulpe with my figures?",
        answerBefore:
          "Your amounts are never stored in the clear. They are encrypted in the database with AES-256-GCM. They are decrypted server-side during your authenticated requests, using two keys kept separately, one of them derived from your PIN. A leak of the database alone is therefore not enough to read them. Your financial amounts and labels are neither shared for advertising nor sold. The ",
        answerLink: "source code is public",
        answerAfter:
          ", so you can check how it works instead of taking my word for it.",
      },
      demo: {
        question: "Can I try it without creating an account?",
        answerBefore: "Yes. The ",
        answerLink: "demo mode",
        answerAfter:
          " lets you use Pulpe with no account and without entering your own figures.",
      },
      free: {
        question: "Is it really free?",
        answerBefore:
          "Yes. Pulpe is free, with no ads and no subscription. It’s a solo project and its ",
        answerLink: "source code is public",
        answerAfter: ".",
      },
      countries: {
        question: "Does it work in Switzerland and France?",
        answer:
          "Yes. Pulpe works with Swiss francs and euros, on the web and on iPhone.",
      },
      sync: {
        question: "How do I find my budgets across web and iPhone?",
        answer:
          "Sign in to the same account on both. Your budgets and your changes are synchronised automatically.",
      },
      deletion: {
        question: "How do I delete my account and my data?",
        answerBefore: "You can request deletion from your ",
        answerLink: "settings",
        answerAfter:
          ". The account and your data are then scheduled for deletion in three days, which gives you that window to change your mind. After it, they are removed from the active systems. Copies may remain temporarily in technical backups, then expire under the hosting provider’s retention policy.",
      },
    },
    contactHeading: "Your question isn’t here?",
    contactText:
      "Write to me directly. I build Pulpe alone and I answer myself.",
    contactGithub: "Bug or suggestion on GitHub",
  },

  guide: {
    metaTitle: "Template or budget: which one should you edit?",
    metaDescription:
      "Understand the difference between a template and a monthly budget in Pulpe, then know which one to edit on iPhone.",
    backToSupport: "Help",
    eyebrow: "Templates and budgets",
    heading: "Template or budget: which one should you edit?",
    intro:
      "The template prepares your ordinary months. A budget stands for one specific month.",
    differenceHeading: "The difference in one sentence.",
    template: {
      eyebrow: "The template",
      title: "Your starting point",
      text: "It holds your usual income, expenses and savings. It’s what prepares your monthly budgets without retyping everything.",
    },
    budget: {
      eyebrow: "The budget",
      title: "One specific month",
      text: "It matches August 2026, for instance. You can adjust it for that month without changing your usual starting point.",
    },
    choiceHeading: "Choose according to what you want to change.",
    choices: [
      { intent: "Change this month only", destination: "The month’s budget" },
      { intent: "Change my ordinary months", destination: "The template" },
      { intent: "Create next month", destination: "A new budget" },
      {
        intent: "Create another reusable starting point",
        destination: "A new template",
      },
    ],
    iphoneEyebrow: "On iPhone",
    iphoneHeading: "Both paths, step by step.",
    budgetSteps: {
      eyebrow: "A single month",
      title: "Edit a monthly budget",
      steps: [
        "Open the “Budgets” tab.",
        "Tap + to create next month’s budget, or open an existing month.",
        "Inside the budget, tap + to add a planned item.",
        "Tap an existing planned item to edit or delete it.",
      ],
    },
    modelSteps: {
      eyebrow: "Your ordinary months",
      title: "Edit the template",
      steps: [
        "Open the “Templates” tab.",
        "Tap + to create a new starting point, or open an existing template.",
        "Tap an existing planned item to edit it.",
        "Choose “Apply” to carry the change over to current and future budgets.",
      ],
    },
    protectedTitle: "Your adjustments stay protected",
    protectedParagraphs: [
      "When you choose “Apply”, Pulpe updates current and future budgets. A planned item you have already edited by hand inside a budget is not overwritten.",
      "On iPhone, you can create a template and edit its planned items. To add or remove a planned item in a template that already exists, use the web version for now.",
    ],
    contactHeading: "Still stuck?",
    contactText:
      "Write to me and say which screen you’re on. I’ll answer you directly.",
  },

  changelog: {
    metaTitle: "What’s new",
    metaDescription:
      "Every new feature and fix in Pulpe. Follow the updates to the web, iOS and Android apps.",
    heading: "What’s new",
    intro: "The latest updates to Pulpe.",
    sections: {
      features: "New",
      fixes: "Fixes",
      technical: "Technical",
    },
    githubRelease: "GitHub Release",
  },

  notFound: {
    title: "This page doesn’t exist",
    text: "The Pulpe app has moved. You can reach it directly on its new domain.",
    appCta: "Go to the app",
    homeCta: "Back to home",
  },

  language: {
    switcherLabel: "Language",
  },
};

export default en;
