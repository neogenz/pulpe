import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { ComparisonTable } from "@/components/guides/ComparisonTable";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { DE_GUIDE_CHROME } from "@/components/guides/chrome";
import { DE_GUIDES, getDeGuide } from "@/components/guides/guides.de";
import { guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale } from "@/lib/i18n";
import { DE_ADVICE_SECTION_PATH } from "@/lib/routes";

const COMPARISON_SLUG = "beste-budget-app-schweiz";
const PREMIUMS_SLUG = "krankenkassenpraemien-budgetieren";

type PageParams = { lang: string; slug: string };
type GuidePageParams = { params: Promise<PageParams> };

// L'export statique refuse un tableau vide : Next le signale comme une
// fonction absente. Cette page n'existe qu'en allemand, donc on émet
// `[lang]` et `[slug]` d'ici, sans renvoyer [] pour en/it.
export function generateStaticParams() {
  return DE_GUIDES.map((guide) => ({ lang: "de", slug: guide.slug }));
}

function resolveDeGuide(lang: string, slug: string) {
  const locale = assertPrefixedLocale(lang);
  if (locale !== "de") notFound();
  if (!DE_GUIDES.some((entry) => entry.slug === slug)) notFound();
  return getDeGuide(slug);
}

export async function generateMetadata({
  params,
}: GuidePageParams): Promise<Metadata> {
  const { lang, slug } = await params;
  return guideMetadata(resolveDeGuide(lang, slug), DE_GUIDE_CHROME);
}

function DeRelatedGuides({ slugs }: { slugs: readonly string[] }) {
  return (
    <RelatedGuides
      slugs={slugs}
      resolve={getDeGuide}
      sectionPath={DE_ADVICE_SECTION_PATH}
      locale="de"
      heading={DE_GUIDE_CHROME.relatedHeading}
    />
  );
}

const comparisonFaq = [
  {
    question: "Welche ist die beste Budget-App für die Schweiz?",
    answer:
      "Das hängt von der Arbeit ab. Für die Jahresplanung ohne Bank: Pulpe. Für die Haushaltsführung im Verein: BudgetCH. Für CSV und einen Assistenten: BudgetHub. Für Umschläge: Goodbudget.",
  },
  {
    question: "Brauchst du einen Bankanschluss?",
    answer:
      "Nein. Die Apps in diesem Vergleich laufen mit Hand-Eingabe oder Dateiimport. Ein Bankanschluss ist nirgendwo Pflicht.",
  },
];

const premiumsFaq = [
  {
    question: "Wie bildest du eine Rückstellung für die Prämienerhöhung?",
    answer:
      "Nimm die heutige Prämie, rechne die bekannte Erhöhung dazu, teile die Differenz durch die Monate bis Januar, und setze diesen Betrag als Planposten. Der Jahresbetrag bleibt gleich: du verteilst ihn nur.",
  },
  {
    question: "Wie hoch ist die mittlere Krankenkassenprämie 2026?",
    answer:
      "393.30 CHF im Monat für Erwachsene und 326.30 CHF für 19- bis 25-Jährige, laut Bundesamt für Gesundheit. Die Erhöhung gegenüber 2025 beträgt 4,4 %.",
  },
  {
    question:
      "Musst du die Krankenkasse wechseln, um die Erhöhung aufzufangen?",
    answer:
      "Nein, das ist nicht das Thema dieser Seite. Ein Wechsel kann helfen, aber hier geht es um die Rückstellung in deiner Planung, damit Januar keine Überraschung wird.",
  },
];

function ComparisonArticle() {
  return (
    <>
      <p>
        Welche Budget-App in der Schweiz zu dir passt, hängt davon ab, ob du das
        Jahr planen, den Haushalt führen oder Dateien importieren willst. Ein
        einziges Produkt gewinnt das nicht für alle drei Fälle.
      </p>
      <p>
        Deutsch, Franken und ein klarer Preis zählen mehr als ein Ranking. Die
        Tabelle unten stellt fünf Apps an denselben Kriterien, inklusive der
        Grenzen von Pulpe.
      </p>

      <h2>Wonach der Vergleich geht</h2>
      <p>
        Eine App aus einem anderen Markt zwingt dich oft ins Englische, in den
        Dollar oder in eine Bankanbindung, die hier fehlt. Die Kriterien: Preis,
        Deutsch, CHF, Bankanschluss, und worin die App stark ist.
      </p>
      <ComparisonTable
        caption="Vergleich von Budget-Apps, die du in der Schweiz nutzen kannst"
        headers={["App", "Preis", "Deutsch", "CHF", "Bank", "Stärke"]}
        rows={[
          ["Pulpe", "Gratis, ohne Limit", "Ja", "Ja", "Nein", "Jahresplanung"],
          [
            "BudgetCH",
            "Gratis (Verein)",
            "Ja",
            "Ja",
            "Nein",
            "Haushaltsführung",
          ],
          [
            "BudgetHub",
            "Gratis begrenzt, dann 6.90 / 11.90\u00a0CHF/Monat",
            "Ja",
            "Ja",
            "CSV, kein Zwangssync",
            "Import und Assistent",
          ],
          [
            "YNAB",
            "14.99 $/Monat oder 109 $/Jahr",
            "Nein (Englisch)",
            "Ein Budget pro Währung",
            "Sync ausserhalb der Schweiz",
            "Umschlagmethode",
          ],
          [
            "Goodbudget",
            "Gratis begrenzt, sonst 10 $/Monat",
            "Englisch",
            "Ja, wenn du es erfasst",
            "Sync nur USA",
            "Geteilte Umschläge",
          ],
        ]}
      />
      <p>
        YNAB stellt den Preis in USD aus, Wechselkurse stehen nicht darin.
        BudgetHub-Preise stammen von der Herstellerseite. Goodbudget: gratis bis
        20 Umschläge, ein Konto, zwei Geräte.
      </p>

      <h2>Für wen welche App</h2>
      <ul>
        <li>
          <strong>Pulpe. </strong>Du willst einen normalen Monat setzen, Steuern
          und Ferien einplanen und das Verfügbar zum Ausgeben der nächsten
          Monate sehen. Keine Bankensynchronisation, kein gemeinsames
          Haushaltsbudget, junges Produkt.
        </li>
        <li>
          <strong>BudgetCH. </strong>Du willst das Tool von Budget-Beratung
          Schweiz, gratis, für einen Haushalt, der Ausgaben festhält. Weniger
          auf die Jahresplanung ausgerichtet.
        </li>
        <li>
          <strong>BudgetHub. </strong>Du willst CSV importieren, Belege scannen
          und einem Assistenten Fragen stellen. Das Gratisangebot ist gedeckelt
          (zwei Konten, fünf KI-Scans pro Monat).
        </li>
        <li>
          <strong>YNAB. </strong>Du arbeitest schon mit der Methode und nimmst
          Englisch, den USD-Tarif und ein Budget pro Währung in Kauf.
        </li>
        <li>
          <strong>Goodbudget. </strong>Geteilte Umschläge, mit den Grenzen des
          Gratisplans.
        </li>
      </ul>
      <p>
        Pulpe synchronisiert keine Bank und teilt keinen Haushalt. Wenn du genau
        das brauchst, nimm das Tool, das es kann. Die Tabelle ist kein bezahltes
        Ranking.
      </p>

      <DeRelatedGuides slugs={[PREMIUMS_SLUG]} />
    </>
  );
}

function PremiumsArticle() {
  return (
    <>
      <p>
        Eine Prämienerhöhung verteilst du auf die Monate, die vor Januar noch
        bleiben. Der Jahresbetrag bleibt gleich: du entscheidest nur, wann du
        ihn zurücklegst.
      </p>
      <p>
        Für 2026 liegt die mittlere Prämie der obligatorischen
        Krankenversicherung bei{" "}
        <mark className="marker-highlight tabular-nums">393.30&nbsp;CHF</mark>{" "}
        im Monat für Erwachsene und bei{" "}
        <mark className="marker-highlight tabular-nums">326.30&nbsp;CHF</mark>{" "}
        für 19- bis 25-Jährige, laut{" "}
        <a
          href="https://www.bag.admin.ch/de/praemien-und-kosten-antworten-auf-haeufige-fragen"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bundesamt für Gesundheit
        </a>
        . Die Erhöhung gegenüber 2025 beträgt 4,4&nbsp;%. Für junge Erwachsene
        nennt das BAG die{" "}
        <a
          href="https://www.bag.admin.ch/de/newnsb/d2okh_kUK_OFhmMDfpyiy"
          target="_blank"
          rel="noopener noreferrer"
        >
          326.30&nbsp;CHF
        </a>{" "}
        im Communiqué vom 23.09.2025.
      </p>

      <h2>So bildest du die Rückstellung</h2>
      <p>
        Nimm deine heutige Prämie. Rechne die bekannte Erhöhung dazu. Die
        Differenz teilst du durch die Monate bis Januar. Dieser Betrag wird ein
        Planposten, wie die Miete.
      </p>
      <p>
        Beispiel: deine Prämie steigt von{" "}
        <strong className="tabular-nums">380&nbsp;CHF</strong> auf{" "}
        <strong className="tabular-nums">397&nbsp;CHF</strong>, also{" "}
        <strong className="tabular-nums">17&nbsp;CHF</strong> mehr im Monat.
        Startest du im September, bleiben vier Monate. 17 × 4 ={" "}
        <strong className="tabular-nums">68&nbsp;CHF</strong> zum Verteilen,
        oder du setzt ab sofort 17&nbsp;CHF mehr auf die Linie. Dann siehst du
        das Verfügbar zum Ausgeben von Oktober bis Dezember schon mit dem
        Januar-Niveau.
      </p>
      <p>
        Dasselbe gilt für Steuern: eine bekannte Ausgabe, im Voraus gesetzt,
        statt einer Rechnung, die auf einmal kommt.
      </p>

      <h2>Was diese Seite nicht behandelt</h2>
      <p>
        Prämienverbilligung und Priminfo sind nützlich, wenn du subventioniert
        wirst oder die Kasse vergleichen willst. Das ist hier nicht das Thema:
        es geht nur um die Rückstellung in deiner Planung.
      </p>

      <h2>Wo das in Pulpe landet</h2>
      <p>
        In Pulpe ist die Prämie ein wiederkehrender Planposten. Passt du den
        Betrag an, rechnen die nächsten Monate neu. Du siehst das Verfügbar zum
        Ausgeben von Januar, ohne auf Januar zu warten.
      </p>

      <DeRelatedGuides slugs={[COMPARISON_SLUG]} />
    </>
  );
}

function articleFor(slug: string) {
  if (slug === COMPARISON_SLUG) {
    return { faq: comparisonFaq, body: <ComparisonArticle /> };
  }
  if (slug === PREMIUMS_SLUG) {
    return { faq: premiumsFaq, body: <PremiumsArticle /> };
  }
  return null;
}

export default async function DeBudgetGuidePage({ params }: GuidePageParams) {
  const { lang, slug } = await params;
  const guide = resolveDeGuide(lang, slug);
  const article = articleFor(guide.slug);
  if (!article) notFound();

  return (
    <ArticleLayout
      guide={guide}
      faq={article.faq}
      dict={await getDictionary("de")}
      chrome={DE_GUIDE_CHROME}
    >
      {article.body}
    </ArticleLayout>
  );
}
