import { ChartNoAxesCombined, FileSpreadsheet } from "lucide-react";
import { Section } from "@/components/ui";

const LIMITS = [
  {
    icon: FileSpreadsheet,
    title: "Avec un tableur, tu dois tout tenir à jour.",
    text: "Au moindre changement, tu modifies les lignes, les mois et parfois les formules. Si ton fichier n’est plus à jour, ta projection ne l’est plus non plus.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Le suivi commence une fois l’argent dépensé.",
    text: "Une app de suivi t’explique où ton argent est parti. Elle t’aide moins à savoir si une dépense prévue en septembre tient encore dans ton budget.",
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
          <h2 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-text sm:text-5xl">
            Les impôts tombent en juillet. Tu sais déjà combien il te restera en
            août.
          </h2>
          <p className="pretty mt-6 text-lg leading-relaxed text-text-secondary">
            Une grosse dépense tombe un mois, mais son effet se fait sentir bien
            après. Avec un tableur, tu dois recalculer la suite. Une app de
            suivi ne la montre qu&apos;une fois payée.
          </p>
        </header>

        {/* Un filet d'ouverture, un filet entre les deux limites. Le troisième,
            sous la dernière, ne fermait rien : la colonne de gauche s'arrête
            bien plus haut, donc il traversait la moitié droite tout seul. */}
        <div className="border-t border-text/10 lg:col-span-7">
          {LIMITS.map((point, index) => (
            <article
              key={point.title}
              className={`py-7 sm:py-8 ${index > 0 ? "border-t border-text/10" : ""}`}
            >
              <point.icon
                className="size-6 text-primary"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <h3 className="mt-5 text-xl font-semibold text-text">
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
