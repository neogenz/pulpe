import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("epargner-avec-salaire-suisse");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const faq = [
  {
    question: "Combien épargner avec un salaire suisse ?",
    answer:
      "Un repère large se situe autour de 10 à 20 % du revenu net. Le taux d’épargne des ménages tourne autour de 17,5 à 20 %, et le quintile le plus bas reste sous 5 % (OFS). Le montant que tu tiens chaque mois compte plus que le pourcentage affiché.",
  },
];

export default async function EpargnerSalairePage() {
  return (
    <ArticleLayout
      guide={guide}
      faq={faq}
      dict={await getDictionary(DEFAULT_LOCALE)}
    >
      <p>
        Pour épargner avec un salaire suisse, tu décides le montant avant de
        dépenser, tu le vire dès la paie, et tu le traites comme une prévision.
        Le pourcentage vient après, une fois le loyer, les primes et les impôts
        posés.
      </p>
      <p>
        Autour du salaire médian de{" "}
        <mark className="marker-highlight">7’024&nbsp;CHF brut</mark> par mois (
        <a
          href="https://dam-api.bfs.admin.ch/hub/api/dam/assets/36195848/master"
          target="_blank"
          rel="noopener noreferrer"
        >
          OFS, ESS 2024
        </a>
        ), 10&nbsp;% du net, c’est déjà une ligne qui se voit. 20&nbsp;% est un
        plafond confortable, pas une norme. Le taux d’épargne des ménages se
        situe autour de 17,5 à 20&nbsp;% ; le quintile le plus bas reste sous
        5&nbsp;% (OFS).
      </p>

      <h2>Payer son épargne d’abord</h2>
      <p>
        Le jour où le salaire arrive, tu vire le montant choisi. Ce qui reste
        paie le quotidien. Inverser l’ordre — « j’épargne s’il reste quelque
        chose » — revient à n’épargner que les mois trop calmes.
      </p>
      <p>
        Un ordre simple : fonds de secours (trois mois de dépenses), puis
        objectifs datés (vacances, déménagement), puis{" "}
        <a
          href="https://www.ch.ch/fr/travail/prevoyance-vieillesse/prevoyance-privee-3eme-pilier/"
          target="_blank"
          rel="noopener noreferrer"
        >
          pilier 3a
        </a>{" "}
        si tu y es éligible. Le 3a se déduit, mais il n’est pas un bas de laine
        : tu ne le retires pas librement.
      </p>

      <h2>Les primes sont une dépense fixe</h2>
      <p>
        Avant de viser 20&nbsp;%, pose la prime maladie. En 2026, la moyenne
        adulte est à 393.30 CHF (OFSP). Ce n’est pas de l’épargne. C’est une
        prévision, au même titre que le loyer. Un budget qui « épargne 20&nbsp;%
        » en oubliant les primes ment sur le disponible.
      </p>

      <h2>Si 10 % ne passe pas</h2>
      <p>
        Tu baisses le montant, tu ne supprimes pas la ligne. 50 CHF virés chaque
        mois construisent plus qu’un objectif de 20&nbsp;% abandonné en mars.
        Recalcule après une hausse de loyer ou de prime : le bon pourcentage est
        celui qui laisse un disponible tenable.
      </p>
      <p>
        Dans Pulpe, l’épargne est une prévision. Tu vois ce qu’il reste pour les
        mois suivants, et tu peux lisser un objectif sur plusieurs mois au lieu
        de tout prendre sur un seul.
      </p>

      <RelatedGuides
        slugs={[
          "budget-mensuel-suisse-exemple",
          "comment-faire-son-budget-en-suisse",
        ]}
        calculator
      />
    </ArticleLayout>
  );
}
