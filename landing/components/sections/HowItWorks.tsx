import { Section, Screenshot } from "@/components/ui";

const STEPS = [
  {
    number: "01",
    title: "Pose ton mois type",
    description:
      "Ajoute tes revenus, tes dépenses récurrentes et ce que tu veux mettre de côté.",
    src: "/screenshots/responsive/ecran-des-modeles.webp",
    desktopSrc: "/screenshots/webapp/ecran-des-modeles.webp",
    label: "Modèle mensuel dans Pulpe",
    desktopWidth: 1261,
    desktopHeight: 956,
  },
  {
    number: "02",
    title: "Ajoute les exceptions",
    description:
      "Place les impôts, vacances et gros achats dans les mois où ils auront vraiment lieu.",
    src: "/screenshots/responsive/modal-ajout-transaction.webp",
    desktopSrc: "/screenshots/webapp/modal-ajout-transaction.webp",
    label: "Ajout d’une dépense prévue dans Pulpe",
    desktopWidth: 1260,
    desktopHeight: 955,
  },
  {
    number: "03",
    title: "Lis ton année",
    description:
      "Chaque mois affiche ton disponible. Si le réel change, la projection suit.",
    src: "/screenshots/responsive/vue-calendrier-annuel.webp",
    desktopSrc: "/screenshots/webapp/vue-calendrier-annuel.webp",
    label: "Vue annuelle du budget dans Pulpe",
    desktopWidth: 1695,
    desktopHeight: 1354,
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium text-primary">De zéro à douze mois</p>
        <h2 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Ton année prend forme en trois gestes.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-text-secondary">
          Pas de catégorie à deviner ni de rapport à décoder. Tu renseignes ce
          qui compte, Pulpe montre la suite.
        </p>
      </div>

      <div className="relative mt-14">
        <div
          aria-hidden="true"
          className="absolute left-[16.66%] right-[16.66%] top-5 hidden h-px bg-primary/20 md:block"
        />
        <ol className="relative grid gap-12 md:grid-cols-3 md:gap-5 lg:gap-8">
          {STEPS.map((step) => (
            <li key={step.number} className="relative">
              <div className="relative z-10 flex items-center gap-4 md:flex-col md:gap-3 md:text-center">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-[var(--shadow-organic)]">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-text">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary md:min-h-20">
                    {step.description}
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <Screenshot
                  src={step.src}
                  desktopSrc={step.desktopSrc}
                  label={step.label}
                  mobileWidth={750}
                  mobileHeight={1190}
                  desktopWidth={step.desktopWidth}
                  desktopHeight={step.desktopHeight}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
