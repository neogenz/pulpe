import { CalendarX, TableProperties, Wallet } from "lucide-react";
import { Section } from "@/components/ui";

const PROOFS = [
  ["12 mois", "visibles d’un coup"],
  ["3 minutes", "pour poser ton année"],
  ["Web + iOS", "le même budget partout"],
];

const SUPPORTING = [
  {
    icon: TableProperties,
    title: "Ton Excel a 12 feuilles",
    text: "Avec Pulpe, un changement se répercute sans reprendre chaque mois à la main.",
  },
  {
    icon: Wallet,
    title: "Le 25, tu retiens ton souffle",
    text: "Pulpe calcule ce qui reste réellement disponible après tes dépenses et ton épargne prévues.",
  },
];

export function PainPoints() {
  return (
    <Section id="pain-points" className="pt-10 lg:pt-16">
      <dl className="grid border-y border-text/10 sm:grid-cols-3">
        {PROOFS.map(([value, label], index) => (
          <div
            key={value}
            className={`py-5 sm:px-6 sm:text-center ${
              index > 0
                ? "border-t border-text/10 sm:border-l sm:border-t-0"
                : ""
            }`}
          >
            <dt className="text-sm text-text-secondary">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-text">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-20 grid items-stretch gap-8 lg:grid-cols-5 lg:gap-12">
        <div className="relative overflow-hidden rounded-[var(--radius-large)] bg-surface-alt p-7 sm:p-10 lg:col-span-3 lg:p-12">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative max-w-xl">
            <div className="mb-8 flex size-12 items-center justify-center rounded-full bg-surface text-primary shadow-[var(--shadow-organic)]">
              <CalendarX className="size-6" strokeWidth={1.7} />
            </div>
            <p className="text-sm font-medium text-primary">Juillet</p>
            <h2 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl">
              Les impôts tombent. Ton mois ne devrait pas tomber avec.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-text-secondary sm:text-lg">
              Un tableur constate l&apos;écart. Pulpe réajuste la suite de ton
              année pour que tu voies immédiatement ce que ce changement
              implique.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center lg:col-span-2">
          {SUPPORTING.map((point, index) => (
            <article
              key={point.title}
              className={`py-7 ${index > 0 ? "border-t border-text/10" : ""}`}
            >
              <point.icon className="size-6 text-primary" strokeWidth={1.7} />
              <h3 className="mt-5 text-xl font-semibold text-text">
                {point.title}
              </h3>
              <p className="mt-3 leading-relaxed text-text-secondary">
                {point.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
