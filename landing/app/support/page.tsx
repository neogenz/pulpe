import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccordionItem, Container, Section } from "@/components/ui";
import { FinalCTA, Footer, Header } from "@/components/sections";
import { angularUrl, CONTACT_EMAIL, GITHUB_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Aide et questions fréquentes",
  description:
    "Questions fréquentes sur Pulpe : saisie manuelle, protection des montants, gratuité, mode démo et disponibilité en Suisse et en France.",
  alternates: {
    canonical: "/support",
  },
};

const linkClass =
  "rounded-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const DEMO_URL = angularUrl("/welcome", "faq_demo");
const SETTINGS_URL = angularUrl("/settings", "faq_delete_account");

interface FaqItem {
  question: string;
  answer?: ReactNode;
  plainAnswer: string;
}

const faqs: FaqItem[] = [
  {
    question: "À quoi sert Pulpe, concrètement ?",
    plainAnswer:
      "Tu poses ton année une fois, puis tu ajustes au fur et à mesure. Si tu déplaces une dépense, rediriges de l'épargne ou décales un projet, tu vois ce que ça change sur les mois suivants sans repartir de zéro.",
  },
  {
    question: "Pourquoi Pulpe plutôt qu'Excel ?",
    plainAnswer:
      "Excel fait le job, mais les formules deviennent vite fragiles dès que tu bouges une ligne. Et sur mobile, c'est pénible. Pulpe garde la vue d'ensemble et recalcule la suite quand tu ajustes ton budget.",
  },
  {
    question: "Pourquoi Pulpe ne se connecte pas à ma banque ?",
    plainAnswer:
      "J'aurais aimé proposer une synchronisation bancaire. Pour le faire correctement en Suisse et en France, il faut passer par des prestataires externes et gérer des contraintes réglementaires. Pour un projet que je développe seul, le soir après le boulot, le coût est trop élevé. Donc, pour l'instant, la saisie reste manuelle.",
  },
  {
    question: "Pourquoi confier mes chiffres à Pulpe ?",
    answer: (
      <>
        Tes montants ne sont jamais stockés en clair. Pour les déchiffrer, il
        faut deux clés conservées séparément, dont une dérivée de ton code PIN.
        Une fuite de la base seule ne suffit donc pas à les lire. Le{" "}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          code source est public
        </a>
        , tu peux vérifier son fonctionnement au lieu de me croire sur parole.
      </>
    ),
    plainAnswer:
      "Tes montants ne sont jamais stockés en clair. Pour les déchiffrer, il faut deux clés conservées séparément, dont une dérivée de ton code PIN. Une fuite de la base seule ne suffit donc pas à les lire. Le code source est public, tu peux vérifier son fonctionnement au lieu de me croire sur parole.",
  },
  {
    question: "Est-ce que je peux essayer sans créer de compte ?",
    answer: (
      <>
        Oui. Le{" "}
        <a href={DEMO_URL} className={linkClass}>
          mode démo
        </a>{" "}
        te laisse utiliser Pulpe sans compte et sans saisir tes propres
        chiffres.
      </>
    ),
    plainAnswer:
      "Oui. Le mode démo te laisse utiliser Pulpe sans compte et sans saisir tes propres chiffres.",
  },
  {
    question: "C'est vraiment gratuit ?",
    answer: (
      <>
        Oui. Pulpe est gratuit, sans publicité ni abonnement. C'est un projet
        solo et son{" "}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          code source est public
        </a>
        .
      </>
    ),
    plainAnswer:
      "Oui. Pulpe est gratuit, sans publicité ni abonnement. C'est un projet solo et son code source est public.",
  },
  {
    question: "Pulpe fonctionne-t-il en Suisse et en France ?",
    plainAnswer:
      "Oui. Pulpe fonctionne avec les francs suisses et les euros, sur le web et sur iPhone.",
  },
  {
    question: "Comment retrouver mes budgets entre le web et l'iPhone ?",
    plainAnswer:
      "Connecte-toi au même compte sur les deux. Tes budgets et tes modifications sont synchronisés automatiquement.",
  },
  {
    question: "Comment supprimer mon compte et mes données ?",
    answer: (
      <>
        Tu peux demander la suppression depuis les{" "}
        <a href={SETTINGS_URL} className={linkClass}>
          paramètres
        </a>
        . Le compte est alors programmé pour être supprimé dans trois jours, ce
        qui te laisse ce délai pour changer d&apos;avis. Après ça, la suppression
        est définitive.
      </>
    ),
    plainAnswer:
      "Tu peux demander la suppression depuis les paramètres. Le compte est alors programmé pour être supprimé dans trois jours, ce qui te laisse ce délai pour changer d'avis. Après ça, la suppression est définitive.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.plainAnswer,
    },
  })),
};

const faqJsonLdString = JSON.stringify(faqJsonLd).replace(/</g, "\\u003c");

export default function SupportPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLdString }}
      />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>

      <Header />

      <main id="main-content">
        <section className="hero-mesh relative overflow-hidden pb-10 pt-[calc(9rem+env(safe-area-inset-top))] md:pb-16 md:pt-[calc(10rem+env(safe-area-inset-top))]">
          <Container>
            <div className="mx-auto max-w-3xl">
              <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
                Tout ce que tu veux savoir sur Pulpe.
              </h1>
              <p className="pretty mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary sm:text-xl">
                Les réponses aux questions qu&apos;on me pose avant de
                commencer. Si la tienne manque, écris-moi directement.
              </p>
            </div>
          </Container>
        </section>

        <Section aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl">
            <h2
              id="faq-heading"
              className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl"
            >
              Les questions qu&apos;on me pose le plus.
            </h2>

            <div className="mt-10 space-y-3">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer ?? faq.plainAnswer}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section aria-labelledby="contact-heading">
          <div className="mx-auto max-w-3xl border-t border-text/10 pt-10">
            <h2
              id="contact-heading"
              className="text-3xl font-bold leading-tight tracking-[-0.025em] text-text"
            >
              Ta question n&apos;est pas là ?
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-secondary">
              Écris-moi directement. Je développe Pulpe seul et je réponds
              moi-même.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-text-secondary">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={`${linkClass} inline-flex min-h-11 items-center`}
              >
                {CONTACT_EMAIL}
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} inline-flex min-h-11 items-center`}
              >
                Bug ou suggestion sur GitHub
              </a>
            </div>
          </div>
        </Section>

        <FinalCTA />
      </main>

      <Footer />
    </>
  );
}
