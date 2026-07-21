import { Section, Screenshot } from "@/components/ui";

export function Solution() {
  return (
    <Section id="solution">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Pose un mois type. Pulpe projette la suite.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-secondary sm:text-xl">
          Tu pars d&apos;un mois habituel. Pulpe en fait la base des mois suivants,
          puis tu places les impôts, les vacances et les gros achats là où ils
          auront lieu.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 items-start gap-3 sm:gap-6 lg:gap-8">
        <figure>
          <figcaption className="mb-3 flex items-baseline gap-2 sm:mb-4">
            <span className="text-sm font-semibold text-primary">01</span>
            <span className="font-semibold text-text">Ton mois type</span>
          </figcaption>
          <Screenshot
            src="/screenshots/responsive/ecran-des-modeles.webp"
            desktopSrc="/screenshots/webapp/ecran-des-modeles.webp"
            label="Le mois type qui sert de base au budget"
            mobileWidth={750}
            mobileHeight={1190}
            desktopWidth={1261}
            desktopHeight={956}
          />
        </figure>

        <figure>
          <figcaption className="mb-3 flex items-baseline gap-2 sm:mb-4">
            <span className="text-sm font-semibold text-primary">02</span>
            <span className="font-semibold text-text">Ton année</span>
          </figcaption>
          <Screenshot
            src="/screenshots/responsive/vue-calendrier-annuel.webp"
            desktopSrc="/screenshots/webapp/vue-calendrier-annuel.webp"
            label="Les mois projetés à partir du mois type"
            mobileWidth={750}
            mobileHeight={1190}
            desktopWidth={1695}
            desktopHeight={1354}
          />
        </figure>
      </div>
    </Section>
  );
}
