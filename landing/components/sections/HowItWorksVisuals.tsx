import type { ReactNode } from "react";
import { Amount } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";

type VisualsDict = Dictionary["home"]["howItWorks"]["visuals"];

// Three different reads for three different steps, instead of three tables of
// numbers a visitor has to add up: a composition, a time series, then the same
// composition once the year has been filled in. One arithmetic runs through all
// three, on 3 500 of income: 1 600 of recurring expense and 500 set aside leave
// 1 400 a month. July adds 900 of tax, which is why the chart dips there and why
// the third visual keeps only 500. The chart dips three times, once per category
// the step's copy announces: tax, holidays, a big purchase.
const INCOME = 3500;
const FULL_MONTH = 1400;

// Une rampe de neutres pour ce qui est déjà engagé, le vert pour ce qui reste.
// Les impôts appartiennent à la première famille : c'est de l'argent pris, pas
// une catégorie à part. Le jaune du surligneur qui tenait ce rôle sortait à
// 1,3:1 sur la carte, invisible sur une pastille de 6px, et faisait porter deux
// sens au même token que la preuve des témoignages.
const SEGMENT_TONE = {
  recurring: "bg-text/25",
  saving: "bg-text/45",
  tax: "bg-text/65",
  available: "bg-primary",
} as const;

type Segment = {
  role: keyof typeof SEGMENT_TONE;
  label: string;
  amount: number;
};

function StepFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  // aria-hidden: these illustrate the sentence printed beside them. The
  // sr-only figcaption in HowItWorks already names each one, and reading sample
  // amounts aloud would add length without adding meaning.
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-black/5"
    >
      <p className="border-b border-text/[0.06] px-4 py-3 text-xs font-semibold text-text-secondary">
        {title}
      </p>
      <div className="flex flex-1 flex-col gap-4 px-4 py-5">{children}</div>
    </div>
  );
}

// La même barre revient à l'étape 3 : le lecteur compare directement, un bloc
// d'impôts apparaît et la part verte se réduit.
function CompositionBar({
  segments,
  incomeLabel,
}: {
  segments: Segment[];
  incomeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-baseline justify-between text-xs text-text-secondary">
        <span>{incomeLabel}</span>
        <Amount value={INCOME} className="font-medium text-text" showUnit />
      </p>
      <span className="flex h-3 gap-px overflow-hidden rounded-full">
        {segments.map((segment) => (
          <span
            key={segment.role}
            className={SEGMENT_TONE[segment.role]}
            style={{ width: `${(segment.amount / INCOME) * 100}%` }}
          />
        ))}
      </span>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-4 text-text-secondary">
        {segments.map((segment) => (
          <span key={segment.role} className="flex items-center gap-1.5">
            <span
              className={`size-1.5 shrink-0 rounded-full ${SEGMENT_TONE[segment.role]}`}
            />
            {segment.label}
            <Amount value={segment.amount} className="text-text" />
          </span>
        ))}
      </p>
    </div>
  );
}

function Payoff({ value, label }: { value: number; label: string }) {
  return (
    <p className="mt-auto">
      <Amount
        value={value}
        className="block text-3xl font-semibold leading-none text-primary"
        showUnit
        unitClassName="text-sm font-medium"
      />
      <span className="mt-1.5 block text-xs text-text-secondary">{label}</span>
    </p>
  );
}

export function MonthTemplateVisual({ dict }: { dict: VisualsDict }) {
  return (
    <StepFrame title={dict.templateTitle}>
      <CompositionBar
        incomeLabel={dict.income}
        segments={[
          { role: "recurring", label: dict.recurring, amount: 1600 },
          { role: "saving", label: dict.saving, amount: 500 },
          { role: "available", label: dict.available, amount: FULL_MONTH },
        ]}
      />
      <Payoff value={FULL_MONTH} label={dict.templatePayoff} />
    </StepFrame>
  );
}

// Douze mois, dont trois décrochent. Le montant est structurel, l'initiale
// arrive du catalogue : `G` ouvre l'année en italien, pas `J`.
const MONTH_AVAILABLE = [
  FULL_MONTH,
  FULL_MONTH,
  FULL_MONTH,
  FULL_MONTH,
  FULL_MONTH,
  FULL_MONTH,
  500,
  700,
  FULL_MONTH,
  FULL_MONTH,
  FULL_MONTH,
  200,
];

export function YearSpreadVisual({ dict }: { dict: VisualsDict }) {
  const months = MONTH_AVAILABLE.map((available, index) => ({
    key: index,
    initial: dict.monthInitials[index],
    available,
  }));

  return (
    <StepFrame title={dict.yearTitle}>
      {/* La ligne pointillée porte le mois plein, donc les barres n'ont pas
          besoin d'être étiquetées une par une : seuls les mois qui décrochent
          affichent leur montant, et ils sont exactement les trois catégories
          que la copie de l'étape annonce. Les hauteurs sont en pourcentage pour
          que le graphe remplisse la rangée partagée par les trois visuels. */}
      <div className="flex flex-1 flex-col gap-2">
        <Amount
          value={FULL_MONTH}
          className="text-[11px] leading-4 text-text-secondary"
          showUnit
        />
        <div className="relative flex min-h-28 flex-1 items-end gap-1.5">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-text/25" />
          {months.map((month) => (
            <span
              key={month.key}
              className="flex h-full flex-1 flex-col justify-end"
            >
              {month.available < FULL_MONTH ? (
                <Amount
                  value={month.available}
                  className="mb-1 text-center text-[10px] leading-3 text-text"
                />
              ) : null}
              <span
                className="w-full rounded-t-sm bg-primary"
                style={{ height: `${(month.available / FULL_MONTH) * 100}%` }}
              />
            </span>
          ))}
        </div>
        <p className="flex gap-1.5 text-[11px] leading-4 text-text-secondary">
          {months.map((month) => (
            <span key={month.key} className="flex-1 text-center">
              {month.initial}
            </span>
          ))}
        </p>
      </div>
      {/* Trois évènements sur une ligne de 11px : la colonne descend à 192px
          à 768px, donc la légende se passe des articles pour tenir sur deux
          lignes. Le figcaption sr-only porte la phrase complète. */}
      <p className="text-[11px] leading-4 text-text-secondary">
        {dict.yearLegend}
      </p>
    </StepFrame>
  );
}

export function MonthAvailableVisual({ dict }: { dict: VisualsDict }) {
  return (
    <StepFrame title={dict.monthTitle}>
      <CompositionBar
        incomeLabel={dict.income}
        segments={[
          { role: "recurring", label: dict.recurring, amount: 1600 },
          { role: "saving", label: dict.saving, amount: 500 },
          { role: "tax", label: dict.tax, amount: 900 },
          { role: "available", label: dict.available, amount: 500 },
        ]}
      />
      <Payoff value={500} label={dict.monthPayoff} />
    </StepFrame>
  );
}
