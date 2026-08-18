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

type PageParams = { lang: string; slug: string };
type LangParams = { params: { lang: string } | Promise<{ lang: string }> };
type GuidePageParams = { params: Promise<PageParams> };

export async function generateStaticParams({ params }: LangParams) {
  const { lang } = await params;
  if (lang !== "de") return [];
  return [{ slug: COMPARISON_SLUG }];
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

export default async function DeBudgetGuidePage({ params }: GuidePageParams) {
  const { lang, slug } = await params;
  const guide = resolveDeGuide(lang, slug);
  if (guide.slug !== COMPARISON_SLUG) notFound();

  return (
    <ArticleLayout
      guide={guide}
      faq={comparisonFaq}
      dict={await getDictionary("de")}
      chrome={DE_GUIDE_CHROME}
    >
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

      <RelatedGuides
        slugs={["krankenkassenpraemien-budgetieren"]}
        resolve={getDeGuide}
        sectionPath={DE_ADVICE_SECTION_PATH}
        locale="de"
        heading={DE_GUIDE_CHROME.relatedHeading}
      />
    </ArticleLayout>
  );
}
