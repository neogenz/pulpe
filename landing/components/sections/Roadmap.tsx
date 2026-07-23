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
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
            Ce qui est prêt. Ce qui arrive.
          </h2>
        </div>
        <Link
          href="/changelog"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg px-1 font-medium text-primary transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto motion-reduce:transform-none motion-reduce:transition-none"
        >
          Voir les nouveautés
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <ol className="mt-10 grid overflow-hidden rounded-[var(--radius-large)] bg-surface shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-black/5 md:grid-cols-3">
        {ROADMAP.map((stage, index) => (
          <li
            key={stage.status}
            className={`p-6 sm:p-8 ${
              index > 0
                ? "border-t border-text/10 md:border-l md:border-t-0"
                : ""
            } ${stage.status === "inProgress" ? "bg-surface-alt/60" : ""}`}
          >
            <div className="flex items-center gap-3">
              <stage.icon
                className="size-5 text-primary"
                strokeWidth={1.7}
                aria-hidden="true"
              />
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
    </Section>
  );
}
