import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { ComparisonTable } from "@/components/guides/ComparisonTable";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("pulpe-vs-budgethub");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const faq = [
  {
    question: "Pulpe et BudgetHub connectent-elles la banque ?",
    answer:
      "Non, ce n’est obligatoire ni d’un côté ni de l’autre. BudgetHub permet l’import CSV. Pulpe reste en saisie manuelle.",
  },
];

export default async function PulpeVsBudgetHubPage() {
  return (
    <ArticleLayout
      guide={guide}
      faq={faq}
      dict={await getDictionary(DEFAULT_LOCALE)}
    >
      <p>
        Choisis BudgetHub si tu veux importer tes extraits, scanner des
        justificatifs et poser des questions à un assistant. Choisis Pulpe si tu
        veux une app iPhone native, gratuite sans plafond, qui projette tes mois
        à venir. Les deux évitent la connexion bancaire forcée.
      </p>
      <p>
        BudgetHub le dit ainsi : « Datenhaltung in der Schweiz, Compute in der
        EU ». C’est une PWA, avec un palier gratuit limité à deux comptes et
        cinq scans IA par mois, puis 6,90 ou 11,90 CHF par mois.
      </p>

      <ComparisonTable
        caption="Pulpe comparée à BudgetHub"
        headers={["", "Pulpe", "BudgetHub"]}
        rows={[
          [
            "Prix",
            "Gratuit, sans plafond",
            "Gratuit limité, puis 6.90 / 11.90 CHF/mois",
          ],
          ["Forme", "Web + iPhone natif", "PWA"],
          ["Banque", "Saisie manuelle", "CSV, QR, pas de synchro forcée"],
          ["IA", "—", "BudgetAI (crédits selon l’offre)"],
          ["Angle", "Projection annuelle", "Suivi, import, analyses"],
          ["Foyer", "—", "Hubs pour couples et familles"],
          ["Langues", "FR, EN, DE, IT", "DE, FR, IT, EN"],
        ]}
      />

      <h2>Ce que BudgetHub fait mieux</h2>
      <p>
        L’import CSV (presets pour plusieurs banques suisses), la lecture de
        QR-factures, BudgetAI, et les budgets à plusieurs. Si tu refuses de tout
        retaper, c’est l’outil. Pulpe n’a rien de tout ça aujourd’hui.
      </p>

      <h2>Ce que Pulpe fait mieux</h2>
      <p>
        Une app iPhone native, aucun palier payant, et une vue des mois suivants
        : tu places une dépense en septembre, tu vois le disponible d’octobre.
        BudgetHub raconte surtout le passé et le mois en cours.
      </p>
      <p>
        Pulpe est plus jeune, sans import, sans foyer partagé. Si tu as déjà
        cinquante extraits à classer, BudgetHub te fera gagner du temps.
      </p>

      <RelatedGuides
        slugs={["meilleure-app-budget-suisse", "alternative-ynab-suisse"]}
        calculator
      />
    </ArticleLayout>
  );
}
