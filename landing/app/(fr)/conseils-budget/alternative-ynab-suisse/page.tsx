import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { ComparisonTable } from "@/components/guides/ComparisonTable";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("alternative-ynab-suisse");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const faq = [
  {
    question: "Existe-t-il une alternative gratuite à YNAB en Suisse ?",
    answer:
      "Oui. Pulpe et BudgetCH sont gratuits. BudgetHub a un palier gratuit limité. Aucune ne copie la méthode YNAB à l’identique : elles couvrent le budget suisse autrement.",
  },
  {
    question: "Pourquoi YNAB est gênant en Suisse ?",
    answer:
      "L’interface citée sur l’App Store suisse est en anglais, le tarif est en dollars, et YNAB ne mélange pas plusieurs devises dans un même plan de dépenses.",
  },
];

export default async function AlternativeYnabPage() {
  return (
    <ArticleLayout
      guide={guide}
      faq={faq}
      dict={await getDictionary(DEFAULT_LOCALE)}
    >
      <p>
        Une alternative à YNAB en Suisse, c’est une app qui parle français,
        compte en francs, et ne te facture pas en dollars. YNAB reste une bonne
        méthode d’enveloppes. Elle est chère ici, et elle n’est pas faite pour
        le mois suisse (primes, impôts, 13e).
      </p>
      <p>
        Pulpe est l’option si tu veux projeter l’année sans banque. BudgetCH si
        tu veux un suivi associatif. BudgetHub si tu veux de l’import.
        Goodbudget si tu tiens aux enveloppes. MoneyControl si tu veux un suivi
        mobile léger.
      </p>

      <h2>Ce que YNAB demande en Suisse</h2>
      <ul>
        <li>
          <strong>14,99&nbsp;$ / mois ou 109&nbsp;$ / an</strong>, sans palier
          gratuit, essai 34 jours. Le tarif est en USD : « Exchange rates are
          not reflected in the price ».
        </li>
        <li>
          Interface anglaise : c’est le champ langue de la fiche App Store
          suisse, pas une page marketing.
        </li>
        <li>
          Un budget par devise : tu « can’t use multiple currencies together in
          a single spending plan ».
        </li>
      </ul>
      <p>
        Si tu es déjà à l’aise avec YNAB, rester peut valoir le coût. Si tu
        cherches simplement à voir ce qu’il restera après le loyer, les primes
        et les impôts, une app locale suffit souvent.
      </p>

      <ComparisonTable
        caption="Alternatives à YNAB utilisables en Suisse"
        headers={["App", "Prix", "Langue", "Banque", "À choisir si"]}
        rows={[
          [
            "Pulpe",
            "Gratuit",
            "Français",
            "Non",
            "Tu veux une année devant toi",
          ],
          [
            "BudgetCH",
            "Gratuit",
            "Français",
            "Non",
            "Tu veux un outil associatif pour le ménage",
          ],
          [
            "BudgetHub",
            "Gratuit limité, puis 6.90 / 11.90 CHF/mois",
            "FR / DE / IT / EN",
            "CSV",
            "Tu veux importer tes extraits",
          ],
          [
            "Goodbudget",
            "Gratuit limité, sinon 10 $/mois",
            "Anglais",
            "Synchro US seulement",
            "Tu veux vraiment des enveloppes",
          ],
          [
            "MoneyControl",
            "20 mouvements/mois, puis 8–10 CHF",
            "Français",
            "Non",
            "Tu veux un suivi mobile simple",
          ],
        ]}
      />

      <h2>Ce que Pulpe ne remplace pas</h2>
      <p>
        Pulpe n’est pas YNAB. Pas d’enveloppes nommées, pas de synchro bancaire,
        pas de budget à plusieurs, pas encore d’ancienneté. Si la méthode
        enveloppes est ce qui te tient, Goodbudget ou YNAB restent plus proches.
        Pulpe sert à poser l’année et à voir le disponible des mois qui
        viennent.
      </p>

      <RelatedGuides
        slugs={["meilleure-app-budget-suisse", "pulpe-vs-budgethub"]}
        calculator
      />
    </ArticleLayout>
  );
}
