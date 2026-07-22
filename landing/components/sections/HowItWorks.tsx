import { Screenshot } from "@/components/ui";

const STEPS = [
  {
    number: "1",
    title: "Renseigne un mois habituel",
    description:
      "Ajoute tes revenus, tes dépenses récurrentes et ce que tu veux mettre de côté.",
    image: {
      caption: "Ton mois type",
      content: (
        <Screenshot
          src="/screenshots/responsive/ecran-des-modeles.webp"
          iosSrc="/screenshots/ios/ecran-des-modeles.webp"
          desktopSrc="/screenshots/webapp/ecran-des-modeles.webp"
          label="Le mois type qui sert de base au budget"
          mobileWidth={750}
          mobileHeight={1190}
          desktopWidth={1440}
          desktopHeight={1080}
          desktopAspectRatio="4 / 3"
          fit="contain"
        />
      ),
    },
  },
  {
    number: "2",
    title: "Place ce qui change",
    description:
      "Ajoute les impôts, les vacances et les gros achats dans les mois où ils auront lieu.",
    image: {
      caption: "Ton année",
      content: (
        <Screenshot
          src="/screenshots/responsive/vue-calendrier-annuel.webp"
          iosSrc="/screenshots/ios/vue-annuelle-des-budgets.webp"
          desktopSrc="/screenshots/webapp/vue-calendrier-annuel.webp"
          label="Les mois projetés à partir du mois type"
          mobileWidth={750}
          mobileHeight={1190}
          desktopWidth={1440}
          desktopHeight={1080}
          desktopAspectRatio="4 / 3"
          fit="contain"
        />
      ),
    },
  },
  {
    number: "3",
    title: "Vois combien il te restera",
    description:
      "Ouvre un mois à venir pour voir ton disponible, puis ajuste ton budget si besoin.",
    image: {
      caption: "Ton disponible mensuel",
      content: (
        <Screenshot
          src="/screenshots/responsive/liste-des-previsions.webp"
          iosSrc="/screenshots/ios/detail-du-budget.webp"
          desktopSrc="/screenshots/webapp/liste-des-previsions.webp"
          label="Le disponible prévu pour un mois à venir"
          mobileWidth={750}
          mobileHeight={1190}
          desktopWidth={1440}
          desktopHeight={1080}
          desktopAspectRatio="4 / 3"
          fit="contain"
        />
      ),
    },
  },
];

export function HowItWorks() {
  return (
    <ol className="mx-auto mt-12 grid max-w-6xl gap-y-12 sm:mt-16 md:grid-cols-3 md:gap-x-6 md:gap-y-0 lg:gap-x-8">
      {STEPS.map((step) => (
        <li key={step.number} className="flex min-w-0 flex-col">
          {/* Mobile reads label-then-proof: the copy sits above its screenshot
              so the next step's image never bleeds into the previous step's
              text. Desktop keeps the image-first row, where the three columns
              align on their own. */}
          <StepCopy
            step={step}
            className="mb-5 md:order-2 md:mb-0 md:mt-5 md:text-center"
          />
          <figure className="mx-auto w-full max-w-sm md:order-1 md:max-w-none">
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
        <h3 className="balance text-xl font-semibold tracking-[-0.02em] text-text lg:text-2xl">
          {step.title}
        </h3>
      </div>
      <p className="pretty mt-3 pl-11 text-base leading-relaxed text-text-secondary sm:text-lg md:pl-0 md:text-sm lg:text-base">
        {step.description}
      </p>
    </div>
  );
}
