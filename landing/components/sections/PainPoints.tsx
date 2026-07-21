import { ChartNoAxesCombined, FileSpreadsheet } from "lucide-react";
import { Section } from "@/components/ui";

const LIMITS = [
  {
    icon: FileSpreadsheet,
    title: "Le tableur te demande de tout maintenir.",
    text: "À chaque changement, tu ajustes les lignes, les mois et les formules. La projection dépend de ton fichier autant que de ton budget.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Le suivi arrive après la dépense.",
    text: "Une app centrée sur les dépenses réelles explique où ton argent est parti. Elle t’aide moins à mesurer une décision plusieurs mois avant.",
  },
];

export function PainPoints() {
  return (
    <Section
      id="pain-points"
      className="pain-points-mesh relative overflow-hidden"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <header className="max-w-xl lg:col-span-5">
          <h2 className="balance text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-text sm:text-5xl">
            Tu sais ce que tu as dépensé. Pas ce que tu peux encore prévoir.
          </h2>
          <p className="pretty mt-6 text-lg leading-relaxed text-text-secondary">
            Un voyage, les impôts ou un loyer qui augmente peuvent déséquilibrer
            plusieurs mois. C&apos;est cet effet domino qu&apos;un simple suivi
            mensuel montre mal.
          </p>
        </header>

        <div className="border-y border-text/10 lg:col-span-7">
          {LIMITS.map((point, index) => (
            <article
              key={point.title}
              className={`py-7 sm:py-8 ${index > 0 ? "border-t border-text/10" : ""}`}
            >
              <point.icon className="size-6 text-primary" strokeWidth={1.7} />
              <h3 className="balance mt-5 text-xl font-semibold text-text">
                {point.title}
              </h3>
              <p className="pretty mt-3 max-w-xl leading-relaxed text-text-secondary">
                {point.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
