import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("budgeter-primes-maladie");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const faq = [
  {
    question: "Comment provisionner une hausse de prime dans mon budget ?",
    answer:
      "Prends la prime actuelle, applique la hausse connue, divise la différence par le nombre de mois qui restent avant janvier, et mets ce montant de côté chaque mois. Le total ne change pas : tu le répartis.",
  },
  {
    question: "Quel est le montant moyen d’une prime maladie en 2026 ?",
    answer:
      "393.30 CHF par mois pour un adulte, et 326.30 CHF pour les 19-25 ans, selon l’Office fédéral de la santé publique.",
  },
  {
    question: "Faut-il changer de caisse pour absorber la hausse ?",
    answer:
      "Pas forcément. Changer de caisse peut aider, mais ce guide porte sur le budget : provisionner la hausse dans tes mois, pour qu’elle n’arrive pas comme une surprise en janvier.",
  },
];

export default async function PrimesMaladieGuidePage() {
  return (
    <ArticleLayout
      guide={guide}
      faq={faq}
      dict={await getDictionary(DEFAULT_LOCALE)}
    >
      <p>
        Pour absorber une hausse de prime maladie, tu la répartis sur les mois
        qui restent avant janvier. Tu ne changes pas le total : tu décides
        combien mettre de côté chaque mois, pour que janvier ressemble aux
        autres.
      </p>
      <p>
        En 2026, la prime moyenne de l’assurance obligatoire atteint{" "}
        <mark className="marker-highlight">393.30&nbsp;CHF par mois</mark> pour
        un adulte, et <mark className="marker-highlight">326.30&nbsp;CHF</mark>{" "}
        pour les 19 à 25 ans, d’après l’
        <a
          href="https://www.bag.admin.ch/fr/primes-et-couts-reponses-aux-questions-frequentes"
          target="_blank"
          rel="noopener noreferrer"
        >
          Office fédéral de la santé publique
        </a>
        . La hausse a été de 4,4&nbsp;% par rapport à 2025.
      </p>

      <h2>Comment provisionner la hausse, mois par mois ?</h2>
      <p>
        Tu prends ta prime actuelle. Tu appliques le pourcentage annoncé. La
        différence, tu la divises par les mois qui restent avant le nouvel avis
        de prime. Ce montant devient une prévision, comme le loyer.
      </p>
      <p>
        Exemple : ta prime passe de 380 à 397 CHF, soit 17 CHF de plus par mois.
        Si tu commences en septembre, il reste quatre mois. 17 × 4 = 68 CHF à
        répartir, ou simplement 17 CHF ajoutés à ta ligne « assurance maladie »
        dès maintenant. Tu vois alors combien il te restera en octobre, novembre
        et décembre, avec la prime déjà au niveau de janvier.
      </p>
      <p>
        C’est le même geste que pour les impôts : une dépense connue, posée à
        l’avance, plutôt qu’une facture qui arrive d’un coup.
      </p>

      <h2>Quels chiffres retenir pour 2026 ?</h2>
      <ul>
        <li>
          Prime moyenne adulte :{" "}
          <strong className="tabular-nums">393.30 CHF</strong> / mois (OFSP).
        </li>
        <li>
          Prime 19-25 ans : <strong className="tabular-nums">326.30 CHF</strong>{" "}
          / mois, +4,2&nbsp;% (OFSP).
        </li>
        <li>
          Hausses récentes, relayées par l’OFSP via la{" "}
          <a
            href="https://www.rts.ch/"
            target="_blank"
            rel="noopener noreferrer"
          >
            RTS
          </a>
          : +6,6&nbsp;% (2023), +8,7&nbsp;% (2024), +6&nbsp;% (2025),
          +4,4&nbsp;% (2026).
        </li>
      </ul>
      <p>
        Ces moyennes cachent de grands écarts entre cantons et entre modèles
        (médecin de famille, Telmed, HMO). Ton avis de prime reste la source
        pour <em>ton</em> budget. Les moyennes servent à vérifier que tu n’es
        pas hors sol, pas à remplacer ta facture.
      </p>

      <h2>Et les subsides ?</h2>
      <p>
        En 2024,{" "}
        <mark className="marker-highlight">
          32,2&nbsp;% des Romands ont reçu un subside
        </mark>
        . C’est un taux de recours observé, pas une estimation de « ceux qui y
        auraient droit sans le savoir ». Si tu touches déjà une réduction
        cantonale, provisionne la prime <em>après</em> subside. Si tu n’en
        touches pas, ne compte pas dessus dans le budget de l’année.
      </p>

      <h2>Les chiffres 2027</h2>
      <p>
        Avant l’annonce de l’OFSP, fin septembre, deux ordres de grandeur
        circulent déjà : environ +3,7&nbsp;% selon Comparis (mai 2026), et
        environ 5&nbsp;% signalé par l’OFSP. Ce ne sont pas encore les primes
        officielles. Quand l’annonce paraîtra, cette section reprendra les
        montants exacts. En attendant, tu peux déjà poser une provision sur la
        fourchette haute : si la hausse est plus basse, tu récupères de
        l’available.
      </p>

      <h2>Où ça se place dans Pulpe ?</h2>
      <p>
        Dans Pulpe, la prime est une prévision récurrente. Si tu lisses la
        hausse, tu ajustes le montant de cette ligne, et les mois suivants se
        recalculent. Tu vois le disponible de janvier sans attendre janvier.
      </p>

      <RelatedGuides
        slugs={[
          "comment-faire-son-budget-en-suisse",
          "budget-mensuel-suisse-exemple",
        ]}
        calculator
      />
    </ArticleLayout>
  );
}
