import type { ReactNode } from "react";
import { CurrencyUnit } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
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
// L'ordre des étapes, leur numéro et le visuel de chacune sont structurels et
// restent ici. Seuls le titre, la phrase et la légende changent de langue.
const STEP_IDS = ["template", "year", "month"] as const;

const STEP_VISUALS = {
  template: MonthTemplateVisual,
  year: YearSpreadVisual,
  month: MonthAvailableVisual,
} as const;

interface Step {
  number: string;
  title: string;
  description: string;
  caption: ReactNode;
  visual: ReactNode;
}

export function HowItWorks({
  dict,
}: {
  dict: Dictionary["home"]["howItWorks"];
}) {
  const steps: Step[] = STEP_IDS.map((id, index) => {
    const Visual = STEP_VISUALS[id];
    return {
      number: String(index + 1),
      title: dict.steps[id].title,
      description: dict.steps[id].description,
      // L'unité monétaire suit le visiteur, pas la langue de la page : la
      // légende est donc coupée autour d'elle plutôt qu'écrite d'un bloc.
      caption: (
        <>
          {dict.steps[id].captionLead}
          <CurrencyUnit />
          {dict.steps[id].captionTail}
        </>
      ),
      visual: <Visual dict={dict.visuals} />,
    };
  });

  // Desktop runs on three shared rows: visual, title, paragraph. Each li is a
  // subgrid of those rows, so a title that wraps to two lines at 834px pushes
  // all three paragraphs down together instead of only its own column's.
  return (
    <ol className="mx-auto mt-12 grid max-w-6xl gap-y-12 sm:mt-16 md:grid-cols-3 md:grid-rows-[auto_auto_auto] md:gap-x-6 md:gap-y-0 lg:gap-x-8">
      {steps.map((step) => (
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
            <figcaption className="sr-only">{step.caption}</figcaption>
            {step.visual}
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
  step: Step;
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
