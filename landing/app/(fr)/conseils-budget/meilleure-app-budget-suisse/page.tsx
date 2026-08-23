import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { ComparisonTable } from "@/components/guides/ComparisonTable";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("meilleure-app-budget-suisse");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const faq = [
  {
    question: "Quelle est la meilleure app de budget en Suisse ?",
    answer:
      "Ça dépend de ce que tu veux faire. Pour planifier l’année sans connecter ta banque, Pulpe. Pour un suivi associatif du ménage, BudgetCH. Pour importer des CSV et un assistant, BudgetHub. Pour les enveloppes, Goodbudget.",
  },
  {
    question: "Faut-il une connexion bancaire ?",
    answer:
      "Non. Plusieurs apps suisses fonctionnent en saisie manuelle ou par import de fichier. Une connexion bancaire n’est obligatoire nulle part dans ce comparatif.",
  },
];

export default async function MeilleureAppPage() {
  return (
    <ArticleLayout
      guide={guide}
      faq={faq}
      dict={await getDictionary(DEFAULT_LOCALE)}
    >
      <p>
        La meilleure app de budget en Suisse, c’est celle qui parle français,
        compte en francs, et correspond à ta façon de travailler : planifier
        l’année, suivre le mois, ou importer tes extraits. Il n’y a pas un
        gagnant unique.
      </p>
      <p>
        Pulpe convient si tu veux voir combien il te restera les mois suivants,
        sans banque et sans abonnement. BudgetCH convient si tu veux un outil
        associatif pour le ménage. BudgetHub convient si tu veux de l’import CSV
        et un assistant. Les autres restent utiles dans des cas précis.
      </p>

      <h2>Les critères qui comptent en Suisse</h2>
      <p>
        Une app pensée pour un autre pays te force souvent l’anglais, le dollar
        ou une synchro bancaire qui n’existe pas ici. Les cinq critères de ce
        tableau : langue française, francs suisses, prix réel, connexion
        bancaire, et ce que l’app t’aide à décider.
      </p>
      <ComparisonTable
        caption="Comparatif d’apps de budget utilisables en Suisse"
        headers={["App", "Prix", "Français", "CHF", "Banque", "Point fort"]}
        rows={[
          [
            "Pulpe",
            "Gratuit, sans plafond",
            "Oui",
            "Oui",
            "Non",
            "Projection sur l’année",
          ],
          [
            "BudgetCH",
            "Gratuit (associatif)",
            "Oui",
            "Oui",
            "Non",
            "Suivi du ménage",
          ],
          [
            "BudgetHub",
            "Gratuit limité, puis 6.90 / 11.90 CHF/mois",
            "Oui",
            "Oui",
            "CSV, pas de synchro forcée",
            "Import et BudgetAI",
          ],
          [
            "YNAB",
            "14.99 $/mois ou 109 $/an",
            "Non (anglais)",
            "Un budget par devise",
            "Synchro hors Suisse",
            "Méthode enveloppes",
          ],
          [
            "Goodbudget",
            "Gratuit limité, sinon 10 $/mois",
            "Anglais",
            "Oui si tu le saisis",
            "Synchro US seulement",
            "Enveloppes partagées",
          ],
          [
            "MoneyControl",
            "Gratuit jusqu’à 20 mouvements/mois, déblocage 8–10 CHF",
            "Oui",
            "Oui",
            "Non",
            "Suivi simple sur mobile",
          ],
        ]}
      />
      <p>
        Les prix YNAB sont en dollars, « Exchange rates are not reflected in the
        price ». Les prix BudgetHub et MoneyControl viennent de leurs pages
        éditeur. Goodbudget : palier gratuit à 20 enveloppes, un compte, deux
        appareils.
      </p>

      <h2>Qui devrait choisir quoi</h2>
      <ul>
        <li>
          <strong>Pulpe. </strong>Tu veux poser un mois type, placer impôts et
          vacances, et voir le disponible des mois suivants. Pas de synchro
          bancaire, pas de budget à plusieurs, produit encore jeune.
        </li>
        <li>
          <strong>BudgetCH. </strong>Tu veux un outil de Budget-conseil Suisse,
          gratuit, pour un ménage qui note ses dépenses. Moins tourné vers la
          projection annuelle.
        </li>
        <li>
          <strong>BudgetHub. </strong>Tu veux importer un CSV, scanner des
          justificatifs, et poser des questions à un assistant. L’offre gratuite
          est plafonnée (deux comptes, cinq scans IA par mois).
        </li>
        <li>
          <strong>YNAB. </strong>Tu vis déjà dans sa méthode et tu acceptes
          l’anglais, le tarif USD, et un budget par devise.
        </li>
        <li>
          <strong>Goodbudget / MoneyControl. </strong>Enveloppes ou suivi mobile
          léger, avec leurs plafonds.
        </li>
      </ul>
      <p>
        Pulpe n’importe pas tes extraits et ne partage pas un foyer. Si c’est ce
        dont tu as besoin, prends l’outil qui le fait. Le tableau ci-dessus
        n’est pas un classement publicitaire.
      </p>

      <RelatedGuides
        slugs={[
          "pulpe-vs-budgethub",
          "pulpe-vs-budgetch",
          "alternative-ynab-suisse",
        ]}
        calculator
      />
    </ArticleLayout>
  );
}
