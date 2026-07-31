import { CurrencyUnit } from "@/components/ui";
import {
  MonthAvailableVisual,
  MonthTemplateVisual,
  YearSpreadVisual,
} from "./HowItWorksVisuals";

// Les montants des `caption` ne passent pas par `formatMoney` : ce sont les
// figcaption sr-only, et une synthèse vocale lit `1’400` de façon imprévisible
// selon le lecteur. Le chiffre nu reste le plus sûr à l'oreille. Seule la devise
// suit le visiteur, pour qu'un lecteur d'écran n'annonce pas des francs pendant
// que l'écran affiche des euros.
//
// These three visuals are built in code, like the hero dashboard, rather than
// captured from the app. This section's column caps at 341px, and a screenshot
// of an app screen arrives there at a quarter scale with its interface text
// under 4px. Cropping only traded that for amputated cards and dimmed past
// months, because the captures were framed for a different purpose. Drawn
// instead, they stay sharp at any density and carry one consistent arithmetic.
const STEPS = [
  {
    number: "1",
    title: "Renseigne un mois habituel",
    description:
      "Ajoute tes revenus, tes dépenses récurrentes et ce que tu veux mettre de côté.",
    image: {
      caption: (
        <>
          Ton mois type : sur 3 500 <CurrencyUnit /> de revenu, 1 600 de
          dépenses récurrentes et 500 d’épargne laissent 1 400 disponibles
          chaque mois
        </>
      ),
      content: <MonthTemplateVisual />,
    },
  },
  {
    number: "2",
    title: "Place ce qui change",
    description:
      "Ajoute les impôts, les vacances et les gros achats dans les mois où ils auront lieu.",
    image: {
      caption: (
        <>
          Ton année : douze mois à 1 400 <CurrencyUnit /> disponibles, sauf
          juillet à 500 pour les impôts, août à 700 pour les vacances et
          décembre à 200 pour un gros achat
        </>
      ),
      content: <YearSpreadVisual />,
    },
  },
  {
    number: "3",
    title: "Vois combien il te restera",
    description:
      "Ouvre un mois à venir pour voir ton disponible, puis ajuste ton budget si besoin.",
    image: {
      caption: (
        <>
          Juillet : sur 3 500 <CurrencyUnit /> de revenu, 1 600 de récurrent,
          500 d’épargne et 900 d’impôts laissent 500 disponibles
        </>
      ),
      content: <MonthAvailableVisual />,
    },
  },
];

export function HowItWorks() {
  // Desktop runs on three shared rows: visual, title, paragraph. Each li is a
  // subgrid of those rows, so a title that wraps to two lines at 834px pushes
  // all three paragraphs down together instead of only its own column's.
  return (
    <ol className="mx-auto mt-12 grid max-w-6xl gap-y-12 sm:mt-16 md:grid-cols-3 md:grid-rows-[auto_auto_auto] md:gap-x-6 md:gap-y-0 lg:gap-x-8">
      {STEPS.map((step) => (
        <li
          key={step.number}
          className="flex min-w-0 flex-col md:row-span-3 md:grid md:grid-rows-subgrid"
        >
          {/* Mobile reads label-then-proof: the copy sits above its visual
              so the next step's card never bleeds into the previous step's
              text. Desktop keeps the visual-first row, where the three columns
              align on their own. */}
          <StepCopy
            step={step}
            className="mb-5 md:order-2 md:mb-0 md:mt-5 md:row-span-2 md:grid md:grid-rows-subgrid md:text-center"
          />
          <figure className="mx-auto w-full max-w-sm md:order-1 md:h-full md:max-w-none">
            <figcaption className="sr-only">{step.image.caption}</figcaption>
            {step.image.content}
          </figure>
        </li>
      ))}
    </ol>
  );
}

function StepCopy({
  step,
  className = "",
}: {
  step: (typeof STEPS)[number];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 md:flex-col">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          {step.number}
        </span>
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-text">
          {step.title}
        </h3>
      </div>
      <p className="pretty mt-3 pl-11 text-base leading-relaxed text-text-secondary sm:text-lg md:pl-0 md:text-sm lg:text-base">
        {step.description}
      </p>
    </div>
  );
}
