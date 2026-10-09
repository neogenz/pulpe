import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { RelatedGuides } from "@/components/guides/RelatedGuides";
import {
  SourcedFigures,
  type SourcedFiguresProps,
} from "@/components/guides/SourcedFigures";
import { getGuide, guideMetadata } from "@/components/guides/guides";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const guide = getGuide("budgeter-primes-maladie");

export const generateMetadata = (): Promise<Metadata> => guideMetadata(guide);

const OFSP_2026_URL =
  "https://www.bag.admin.ch/fr/newnsb/d2okh_kUK_OFhmMDfpyiy";

// Announcement-day refresh: fill this slot from the OFSP communiqué, then
// update the title, description and updatedAt in guides.ts. The assertion
// keeps TypeScript from narrowing the empty slot to null.
const PREMIUMS_2027 = null as SourcedFiguresProps | null;

const announcedIncreases = [
  {
    year: 2023,
    increase: "+6,6 %",
    href: "https://www.bag.admin.ch/bag/fr/home/das-bag/aktuell/news/news-27-09-2022.html",
  },
  {
    year: 2024,
    increase: "+8,7 %",
    href: "https://www.admin.ch/gov/fr/accueil/documentation/communiques.msg-id-97889.html",
  },
  {
    year: 2025,
    increase: "+6 %",
    href: "https://www.news.admin.ch/fr/nsb?id=102592",
  },
  { year: 2026, increase: "+4,4 %", href: OFSP_2026_URL },
];

const faq = [
  {
    question: "Comment provisionner une hausse de prime dans mon budget ?",
    answer:
      "Prends la prime actuelle, applique la hausse connue. La différence mensuelle, tu l'ajoutes à ta ligne dès maintenant, ou tu la multiplies par les mois qui restent avant janvier. Le total ne change pas : tu le répartis.",
  },
  {
    question: "Quel est le montant moyen d’une prime maladie en 2026 ?",
    answer:
      "393.30 CHF par mois en moyenne, tous âges confondus, et 326.30 CHF pour les 19-25 ans, selon l’Office fédéral de la santé publique.",
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
      cta={{
        lead: "Pose ta prime dans tes prévisions, lisse la hausse sur les mois qui restent, et vois ton disponible de janvier dès aujourd’hui.",
        button: "Créer mes prévisions gratuitement",
      }}
    >
      <p>
        Pour absorber une hausse de prime maladie, tu la répartis sur les mois
        qui restent avant janvier. Tu ne changes pas le total : tu décides
        combien mettre de côté chaque mois, pour que janvier ressemble aux
        autres.
      </p>
      <p>
        En 2026, la prime moyenne de l’assurance obligatoire, tous âges
        confondus, atteint{" "}
        <mark className="marker-highlight">393.30&nbsp;CHF par mois</mark>, et{" "}
        <mark className="marker-highlight">326.30&nbsp;CHF</mark> pour les 19 à
        25 ans. C’est <strong>+4,4&nbsp;%</strong> par rapport à 2025, d’après
        le{" "}
        <a href={OFSP_2026_URL} target="_blank" rel="noopener noreferrer">
          communiqué de l’Office fédéral de la santé publique
        </a>
        .
      </p>

      <h2>Comment provisionner la hausse, mois par mois ?</h2>
      <p>
        Tu prends ta prime actuelle. Tu appliques le pourcentage annoncé. La
        différence mensuelle, tu l’ajoutes à ta ligne tout de suite : ce montant
        devient une prévision, comme le loyer. Si tu lisses jusqu’à janvier, tu
        multiplies cet écart par les mois qui restent : c’est le total à
        répartir.
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
      <SourcedFigures
        figures={[
          {
            value: "393.30 CHF",
            change: "+4,4 %",
            label: "Prime moyenne par mois, tous âges confondus",
          },
          {
            value: "326.30 CHF",
            change: "+4,2 %",
            label: "Prime moyenne par mois, 19 à 25 ans",
          },
        ]}
        source={{
          label: "OFSP, communiqué du 23 septembre 2025",
          href: OFSP_2026_URL,
        }}
      />
      <p>Les quatre dernières hausses annoncées par l’OFSP :</p>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Hausse moyenne des primes annoncée par l’OFSP, de 2023 à 2026
          </caption>
          <thead>
            <tr>
              <th scope="col">Primes</th>
              <th scope="col">Hausse moyenne annoncée</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {announcedIncreases.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td>
                  <strong>{row.increase}</strong>
                </td>
                <td>
                  <a href={row.href} target="_blank" rel="noopener noreferrer">
                    Communiqué officiel
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Ces moyennes cachent de grands écarts entre cantons et entre modèles
        (médecin de famille, Telmed, HMO). Ton avis de prime reste la source
        pour <em>ton</em> budget. Les moyennes servent à vérifier que tu n’es
        pas hors sol, pas à remplacer ta facture.
      </p>

      <h2>Et si je touche un subside ?</h2>
      <p>
        En 2024,{" "}
        <mark className="marker-highlight">
          32,2&nbsp;% des Romands ont reçu un subside
        </mark>
        , selon les chiffres cantonaux{" "}
        <a
          href="https://www.watson.ch/fr/suisse/assurance-maladie/910285635-prime-maladie-combien-les-subsides-coutent-aux-cantons-romands"
          target="_blank"
          rel="noopener noreferrer"
        >
          relayés par watson
        </a>
        . C’est un taux de recours observé, pas une estimation de « ceux qui y
        auraient droit sans le savoir ». Si tu touches déjà une réduction
        cantonale, provisionne la prime <em>après</em> subside. Si tu n’en
        touches pas, ne compte pas dessus dans le budget de l’année.
      </p>

      <h2>Quelle hausse prévoir pour 2027 ?</h2>
      {PREMIUMS_2027 ? (
        <>
          <SourcedFigures {...PREMIUMS_2027} />
          <p>
            Ces moyennes donnent l’ordre de grandeur. Ton avis de prime donne le
            montant pour ton canton et ton modèle : c’est lui que tu poses dans
            ton budget.
          </p>
        </>
      ) : (
        <>
          <p>
            Au printemps 2026, deux prévisions circulaient :{" "}
            <strong>+3,7&nbsp;%</strong> selon{" "}
            <a
              href="https://www.comparis.ch/publikationen/mitteilungen/2026/05/krankenkassenpraemien-steigen-2027-um-3-7prozent"
              target="_blank"
              rel="noopener noreferrer"
            >
              Comparis
            </a>{" "}
            (mai 2026), et <strong>environ 5&nbsp;%</strong> selon l’
            <a
              href="https://www.rts.ch/info/suisse/2026/article/les-primes-d-assurance-maladie-pourraient-augmenter-de-5-a-l-automne-29253733.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              OFSP, cité par la RTS
            </a>
            . Ce sont des ordres de grandeur, pas les primes officielles :
            l’OFSP les publie chaque année fin septembre, et ton avis de prime
            donne ensuite le montant pour ton canton et ton modèle.
          </p>
          <p>
            Tant que tu n’as pas ton avis de prime, pose ta provision sur la
            fourchette haute : si la hausse est plus basse, tu récupères du
            disponible à dépenser.
          </p>
        </>
      )}

      <h2>Où ça se place dans Pulpe ?</h2>
      <p>
        Dans Pulpe, ta prime est une prévision « Mensuel ». Tu ajustes son
        montant au niveau de janvier, et les mois suivants se recalculent. Si tu
        préfères mettre de côté le total calculé plus haut, « Lisser sur
        plusieurs mois » le répartit sur les mois que tu choisis. Tu vois le
        disponible de janvier sans attendre janvier.
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
