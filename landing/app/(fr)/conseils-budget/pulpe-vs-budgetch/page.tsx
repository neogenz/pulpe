import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { ComparisonTable } from "@/components/guides/ComparisonTable";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("pulpe-vs-budgetch");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const faq = [
  {
    question: "Pulpe et BudgetCH sont-elles toutes les deux gratuites ?",
    answer:
      "Oui. Le prix ne départage pas. BudgetCH est porté par Budget-conseil Suisse, une association. Pulpe est un projet solo open source.",
  },
];

export default async function PulpeVsBudgetChPage() {
  return (
    <ArticleLayout
      guide={guide}
      faq={faq}
      dict={await getDictionary(DEFAULT_LOCALE)}
    >
      <p>
        Choisis BudgetCH si tu veux un outil associatif pour noter les dépenses
        du ménage. Choisis Pulpe si tu veux voir les mois suivants avant qu’ils
        n’arrivent. Les deux sont gratuites. Ce n’est pas un match de prix.
      </p>
      <p>
        Budget-conseil Suisse publie BudgetCH depuis des années, en français,
        avec un serveur en Suisse. C’est un appui sérieux, pas un gadget. Pulpe
        est plus récente, tournée vers la projection annuelle, avec une app
        iPhone native.
      </p>

      <ComparisonTable
        caption="Pulpe comparée à BudgetCH"
        headers={["", "Pulpe", "BudgetCH"]}
        rows={[
          ["Prix", "Gratuit, sans plafond", "Gratuit (associatif)"],
          ["Éditeur", "Projet solo, code public", "Budget-conseil Suisse"],
          ["Langue", "FR, EN, DE, IT", "Français"],
          ["Plateforme", "Web + iPhone natif", "App mobile"],
          ["Banque", "Non", "Non"],
          ["Angle", "Planifier l’année", "Suivre le mois du ménage"],
          ["Foyer partagé", "—", "Même compte pour la famille"],
        ]}
      />

      <h2>Quand BudgetCH est le meilleur choix</h2>
      <p>
        Tu vis à plusieurs, tu veux que chacun note ses dépenses, et tu te
        reconnais dans les postes « fixes / variables » de Budget-conseil. L’app
        est pensée pour ça. Pulpe n’a pas de budget partagé : si c’est le
        besoin, BudgetCH gagne, clairement.
      </p>

      <h2>Quand Pulpe est le meilleur choix</h2>
      <p>
        Tu veux placer les impôts, les vacances et une grosse dépense dans les
        mois concernés, puis voir le disponible qui reste. BudgetCH t’aide à
        tenir le mois. Pulpe t’aide à voir si l’année tient.
      </p>
      <p>
        Pulpe est plus jeune, sans synchro, sans mode famille. Ce n’est pas un
        détail : si tu as besoin de ces trois choses, ce n’est pas encore
        l’outil.
      </p>

      <RelatedGuides
        slugs={["meilleure-app-budget-suisse", "pulpe-vs-budgethub"]}
        calculator
      />
    </ArticleLayout>
  );
}
