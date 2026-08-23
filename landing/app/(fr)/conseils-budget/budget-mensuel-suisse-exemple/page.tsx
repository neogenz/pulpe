import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { ComparisonTable } from "@/components/guides/ComparisonTable";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("budget-mensuel-suisse-exemple");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const faq = [
  {
    question: "Quel est un budget mensuel type en Suisse ?",
    answer:
      "Autour du salaire médian brut de 7’024 CHF, un loyer net d’environ 1’451 CHF et une prime adulte de 393.30 CHF. Le reste dépend des impôts, des transports et de l’épargne que tu poses avant de dépenser.",
  },
];

export default async function BudgetMensuelExemplePage() {
  return (
    <ArticleLayout
      guide={guide}
      faq={faq}
      dict={await getDictionary(DEFAULT_LOCALE)}
    >
      <p>
        Un exemple de budget mensuel en Suisse part du revenu net, pose loyer,
        primes et impôts, choisit l’épargne, puis lit ce qui reste. Les chiffres
        ci-dessous sont des ordres de grandeur officiels, pas ton budget.
      </p>
      <p>
        Le salaire médian à plein temps est de{" "}
        <mark className="marker-highlight">7’024&nbsp;CHF brut</mark> par mois
        selon l’
        <a
          href="https://dam-api.bfs.admin.ch/hub/api/dam/assets/36195848/master"
          target="_blank"
          rel="noopener noreferrer"
        >
          enquête 2024 de l’OFS
        </a>
        . Le loyer net moyen tournait autour de 1’451 CHF en 2023 (OFS). La
        prime moyenne 2026 est à 393.30 CHF (OFSP).
      </p>

      <h2>Trois profils, un même geste</h2>
      <p>
        Dans chaque cas, l’épargne est posée avant le quotidien. Le disponible
        n’est pas « ce qui reste si tout va bien » : c’est ce que tu t’autorises
        après les prévisions.
      </p>
      <ComparisonTable
        caption="Trois exemples de budget mensuel en Suisse, en francs"
        headers={["Poste", "Jeune actif", "Couple", "Étudiant"]}
        rows={[
          ["Revenu net", "4’800", "9’000", "1’800"],
          ["Loyer", "1’400", "2’200", "700"],
          ["Primes maladie", "400", "800", "120"],
          ["Provision impôts", "450", "900", "—"],
          ["Transports / abonnements", "250", "400", "80"],
          ["Épargne", "400", "900", "50"],
          ["Disponible à dépenser", "1’900", "3’800", "850"],
        ]}
      />
      <p>
        Ces lignes sont arrondies. Un loyer lausannois, une franchise haute ou
        un 13e salaire changent le tableau. L’intérêt n’est pas le centime :
        c’est de voir que le disponible n’existe qu’après l’épargne.
      </p>

      <h2>Pourquoi regarder l’année, pas seulement le mois</h2>
      <p>
        Le jeune actif ci-dessus a 1’900 CHF de disponible. En juillet, si les
        impôts partent et qu’il n’a rien provisionné, ce mois-là bascule. Sur
        douze mois, la même somme d’impôts est déjà dans la ligne « provision ».
        Janvier et juillet se ressemblent.
      </p>
      <p>
        C’est l’écart avec les PDF institutionnels : ils photographient un mois.
        Un budget suisse se tient quand tu vois aussi août et décembre.
      </p>

      <RelatedGuides
        slugs={[
          "comment-faire-son-budget-en-suisse",
          "epargner-avec-salaire-suisse",
          "budgeter-primes-maladie",
        ]}
        calculator
      />
    </ArticleLayout>
  );
}
