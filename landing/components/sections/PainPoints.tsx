import { ChartNoAxesCombined, FileSpreadsheet } from "lucide-react";
import { Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

const LIMIT_ICONS = {
  spreadsheet: FileSpreadsheet,
  tracking: ChartNoAxesCombined,
} as const;

export function PainPoints({
  dict,
}: {
  dict: Dictionary["home"]["painPoints"];
}) {
  const limits = (["spreadsheet", "tracking"] as const).map((id) => ({
    icon: LIMIT_ICONS[id],
    ...dict[id],
  }));

  return (
    <Section
      id="pain-points"
      className="pain-points-mesh relative overflow-hidden"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <header className="max-w-xl lg:col-span-5">
          <h2 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-text sm:text-5xl">
            {dict.heading}
          </h2>
          <p className="pretty mt-6 text-lg leading-relaxed text-text-secondary">
            {dict.intro}
          </p>
        </header>

        {/* Un filet d'ouverture, un filet entre les deux limites. Le troisième,
            sous la dernière, ne fermait rien : la colonne de gauche s'arrête
            bien plus haut, donc il traversait la moitié droite tout seul. */}
        <div className="border-t border-text/10 lg:col-span-7">
          {limits.map((point, index) => (
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
