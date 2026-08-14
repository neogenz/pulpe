import type { Metadata } from "next";
import { ArticleLayout } from "@/components/guides/ArticleLayout";
import { getGuide, guideMetadata } from "@/components/guides/guides";

const guide = getGuide("comment-faire-son-budget-en-suisse");

export const metadata: Metadata = guideMetadata(guide);

const faq = [
  {
    question: "La règle 50/30/20 marche-t-elle en Suisse ?",
    answer:
      "En partie. Elle propose 50 % du revenu net pour les besoins, 30 % pour les envies et 20 % pour l'épargne. En Suisse, le loyer, l'assurance maladie et les impôts dépassent souvent les 50 % à eux seuls, surtout en ville. Garde l'esprit de la règle, une part d'épargne fixée d'avance, et adapte les pourcentages à ta situation plutôt que de viser les chiffres exacts.",
  },
  {
    question: "Comment gérer les impôts dans un budget suisse ?",
    answer:
      "Si tu n'es pas imposé à la source, mets de côté chaque mois une provision, par exemple un douzième de ta facture de l'an dernier, sur un compte séparé. La facture d'impôts devient une dépense prévue comme une autre, pas une mauvaise surprise. Si tu es imposé à la source, comme la plupart des permis B et des frontaliers, tu peux ignorer cette ligne : l'impôt part avant que le salaire arrive.",
  },
  {
    question: "Quelle application pour faire son budget en Suisse ?",
    answer:
      "Pulpe est pensée pour ça : tu poses tes revenus, tes prévisions et ton épargne, et elle calcule ton disponible à dépenser pour chaque mois de l'année. C'est gratuit, sans publicité ni connexion bancaire, et tes montants sont chiffrés dans la base de données. Tu peux aussi commencer avec un tableur : la méthode de ce guide fonctionne partout.",
  },
];

export default function BudgetSuisseGuidePage() {
  return (
    <ArticleLayout guide={guide} faq={faq}>
      <p>
        Pour faire ton budget en Suisse, pars de ton revenu net mensuel, liste
        tes prévisions (loyer, assurance maladie, impôts, abonnements), choisis
        le montant que tu mets de côté en épargne, et regarde ce qui reste : ton
        disponible à dépenser pour le quotidien. Refais ensuite le même exercice
        pour chaque mois de l&apos;année, parce que les impôts, les primes ou
        les vacances ne tombent pas partout de la même façon.
      </p>
      <p>
        Ce guide déroule la méthode en quatre étapes, chiffres suisses et
        exemple complet à l&apos;appui. Elle marche sur papier, dans un tableur
        ou dans une app : ce qui compte, c&apos;est de la suivre chaque mois.
      </p>

      <h2>Les quatre étapes pour poser ton budget</h2>
      <ol>
        <li>
          <strong>Pose tes revenus. </strong>Ton salaire net, et tout ce qui
          arrive en plus : 13e salaire, primes, revenus annexes. Si ton revenu
          varie, pars du montant le plus bas des derniers mois. Mieux vaut une
          bonne surprise que l&apos;inverse.
        </li>
        <li>
          <strong>Liste tes prévisions. </strong>D&apos;abord les dépenses
          récurrentes, celles qui reviennent chaque mois : loyer, assurance
          maladie, téléphone, transports. Puis les dépenses prévues propres à
          certains mois : impôts, vacances, cadeaux de fin d&apos;année.
          C&apos;est là que la plupart des budgets se trompent. Ces montants
          sont connus d&apos;avance, ils méritent chacun une ligne.
        </li>
        <li>
          <strong>Choisis ton épargne. </strong>Décide d&apos;un montant avant
          de dépenser, pas avec ce qui traîne en fin de mois. Vire-le dès que le
          salaire arrive, sur un compte séparé que tu ne touches pas au
          quotidien.
        </li>
        <li>
          <strong>Regarde ton disponible à dépenser. </strong>Revenus, moins
          prévisions, moins épargne : ce qui reste couvre les courses, les
          sorties et les imprévus. C&apos;est le seul chiffre à retenir au
          quotidien. Tant qu&apos;il est positif, ton mois tient.
        </li>
      </ol>

      <h2>Combien coûte la vie en Suisse ?</h2>
      <p>Trois repères pour situer ton budget :</p>
      <ul>
        <li>
          Le salaire médian suisse est de{" "}
          <mark className="marker-highlight">7’024&nbsp;CHF brut </mark>par mois
          selon l&apos;
          <a
            href="https://www.bfs.admin.ch/bfs/fr/home/statistiques/travail-remuneration/salaires.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            enquête 2024 de l&apos;Office fédéral de la statistique
          </a>
          .
        </li>
        <li>
          La prime moyenne de l&apos;assurance maladie obligatoire atteint{" "}
          <mark className="marker-highlight">393.30&nbsp;CHF par mois </mark>en
          2026, d&apos;après l&apos;
          <a
            href="https://www.bag.admin.ch/bag/fr/home/versicherungen/krankenversicherung/krankenversicherung-praemien.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Office fédéral de la santé publique
          </a>
          .
        </li>
        <li>
          <a
            href="https://budgetberatung.ch"
            target="_blank"
            rel="noopener noreferrer"
          >
            Budget-conseil Suisse
          </a>{" "}
          recommande de garder le loyer{" "}
          <mark className="marker-highlight">sous un quart du revenu net</mark>.
        </li>
      </ul>
      <p>
        À cela s&apos;ajoutent les dépenses faciles à oublier : la redevance
        radio-TV, les frais médicaux qui restent à ta charge en dessous de la
        franchise, la prime d&apos;assurance ménage, ou l&apos;impôt qui varie
        fortement d&apos;un canton à l&apos;autre. Aucune n&apos;est énorme
        seule ; ensemble, elles expliquent pourquoi un budget « de tête » finit
        toujours plus serré que prévu.
      </p>
      <p>
        Voici à quoi ces étapes ressemblent pour un revenu net de 5’000&nbsp;CHF
        par mois :
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Poste</th>
              <th scope="col">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Revenu net</td>
              <td>5’000&nbsp;CHF</td>
            </tr>
            <tr>
              <td>Loyer</td>
              <td>1’400&nbsp;CHF</td>
            </tr>
            <tr>
              <td>Assurance maladie</td>
              <td>400&nbsp;CHF</td>
            </tr>
            <tr>
              <td>Provision impôts</td>
              <td>550&nbsp;CHF</td>
            </tr>
            <tr>
              <td>Transports et abonnements</td>
              <td>250&nbsp;CHF</td>
            </tr>
            <tr>
              <td>Épargne</td>
              <td>500&nbsp;CHF</td>
            </tr>
            <tr>
              <td>
                <strong>Disponible à dépenser</strong>
              </td>
              <td>
                <strong>1’900&nbsp;CHF</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Ces 1’900&nbsp;CHF couvrent tout le quotidien du mois. Et si tes impôts
        ne sont pas prélevés à la source, la provision mensuelle t&apos;évite la
        facture qui fait mal en fin d&apos;année.
      </p>

      <h2>Combien mettre de côté chaque mois ?</h2>
      <p>
        Un repère simple : vise{" "}
        <mark className="marker-highlight">10 à 20 % de ton revenu net</mark>.
        Commence par un fonds de secours qui couvre{" "}
        <strong>trois mois de dépenses</strong>, puis épargne par objectif : les
        vacances, le permis, un déménagement. Si 10 % est hors de portée ce
        mois-ci, mets moins, mais mets quelque chose. Le pourcentage parfait
        compte moins que la régularité : un montant décidé d&apos;avance, chaque
        mois, même modeste.
      </p>
      <p>
        En Suisse, le pilier 3a est souvent la première marche : les versements
        se déduisent de ton revenu imposable, ce qui fait d&apos;une partie de
        ton épargne une économie d&apos;impôts. Mais garde ton fonds de secours
        sur un compte accessible : le 3a est bloqué jusqu&apos;à la retraite,
        sauf exceptions.
      </p>

      <h2>Comment tenir ton budget au fil du mois ?</h2>
      <p>
        Poser le budget est la partie facile. Le tenir, c&apos;est comparer ce
        que tu avais prévu avec ce que tu dépenses réellement, au fil du mois.
        Une fois par semaine, note tes dépenses et regarde où en est ton
        disponible. Dix minutes suffisent.
      </p>
      <p>Deux règles pour que ça tienne :</p>
      <ul>
        <li>
          <strong>Ne vise pas le centime près. </strong>Un ordre de grandeur
          juste vaut mieux qu&apos;un suivi parfait abandonné au bout de trois
          semaines.
        </li>
        <li>
          <strong>Ajuste quand ça change. </strong>Quand un montant prévu bouge,
          corrige la prévision au lieu de faire comme si de rien n&apos;était.
          Un budget qui ne bouge jamais est un budget qu&apos;on a arrêté de
          regarder.
        </li>
      </ul>

      <h2>Pourquoi prévoir l&apos;année entière, pas seulement le mois ?</h2>
      <p>
        Un budget mensuel isolé te dit si ce mois-ci passe. Il ne te dit pas si
        l&apos;année passe. En Suisse, les grosses dépenses sont concentrées :
        les impôts au moment des acomptes, la franchise maladie quand tu es
        malade, les vacances en été. Si tu regardes seulement le mois en cours,
        chacune ressemble à un imprévu. Sur une vue annuelle, ce sont juste des
        mois différents.
      </p>
      <p>
        Le 13e salaire fonctionne pareil, dans l&apos;autre sens : ce n&apos;est
        pas un bonus tombé du ciel, c&apos;est un mois différent que tu peux
        affecter d&apos;avance aux impôts ou aux vacances.
      </p>
      <blockquote>
        Un budget n&apos;est pas là pour t&apos;empêcher de dépenser. Il est là
        pour que tu saches, avant de dépenser, ce que ça change pour les mois
        suivants.
      </blockquote>
      <p>
        C&apos;est exactement ce que fait Pulpe : tu poses ton mois type une
        fois, tu ajustes les mois qui changent, et tu vois combien il te restera
        en juillet ou en décembre, des mois d&apos;avance. Le tout sans
        connexion bancaire.
      </p>
    </ArticleLayout>
  );
}
