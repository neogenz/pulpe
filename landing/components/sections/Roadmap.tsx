import Link from "next/link";
import {
  ArrowRight,
  Check,
  Hammer,
  PackageCheck,
  Telescope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/ui";

type RoadmapStatus = "shipped" | "inProgress" | "next";

interface RoadmapStage {
  status: RoadmapStatus;
  icon: LucideIcon;
  label: string;
  items: string[];
}

const ROADMAP: RoadmapStage[] = [
  {
    status: "shipped",
    icon: PackageCheck,
    label: "Disponible",
    items: [
      "Lisser une grosse dépense sur plusieurs mois",
      "Reporter une prévision sans la recréer",
      "Relier l’épargne à un objectif",
    ],
  },
  {
    status: "inProgress",
    icon: Hammer,
    label: "En cours",
    items: [
      "Suivre la progression de chaque objectif",
      "Retrouver les dépenses avec des tags",
    ],
  },
  {
    status: "next",
    icon: Telescope,
    label: "Ensuite",
    items: [
      "Utiliser Pulpe dans une app Android native",
      "Choisir si une dépense doit être pointée",
    ],
  },
];

function StatusMarker({ status }: { status: RoadmapStatus }) {
  if (status === "shipped") {
    return <Check className="size-3.5 text-primary" aria-hidden="true" />;
  }

  if (status === "inProgress") {
    return (
      <span
        className="size-2.5 rounded-full bg-primary motion-safe:animate-pulse"
        aria-hidden="true"
      />
    );
  }

  return (
    <span className="size-2.5 rounded-full bg-text/25" aria-hidden="true" />
  );
}

export function Roadmap() {
  return (
    <Section id="roadmap">
      <div className="grid gap-10 lg:grid-cols-4 lg:gap-14">
        <div>
          <p className="text-sm font-medium text-primary">
            Les prochaines étapes
          </p>
          <h2 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
            Ce qui est prêt. La suite.
          </h2>
          <p className="mt-5 leading-relaxed text-text-secondary">
            Retrouve ici ce qui est disponible, en cours et prévu ensuite.
          </p>
          <Link
            href="/changelog"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 font-medium text-primary transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none motion-reduce:transition-none"
          >
            Voir les nouveautés
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <ol className="grid overflow-hidden rounded-[var(--radius-large)] bg-surface shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-black/5 md:grid-cols-3 lg:col-span-3">
          {ROADMAP.map((stage, index) => (
            <li
              key={stage.status}
              className={`p-6 sm:p-8 ${
                index > 0
                  ? "border-t border-text/10 md:border-l md:border-t-0"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <stage.icon className="size-5 text-primary" strokeWidth={1.7} />
                <h3 className="font-semibold">{stage.label}</h3>
              </div>
              <ul className="mt-6 space-y-4">
                {stage.items.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <StatusMarker status={stage.status} />
                      <span className="sr-only">Statut : {stage.label}</span>
                    </span>
                    <span className="text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
