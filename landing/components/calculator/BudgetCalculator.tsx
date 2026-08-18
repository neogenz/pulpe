"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { formatMoney } from "@/lib/amount";
import {
  CALCULATOR_CHIPS,
  EMPTY_BUDGET,
  availableToSpend,
  chipLabel,
  committedExpenses,
  removeLine,
  toggleChip,
  updateLineAmount,
  type BudgetInputs,
  type FixedField,
} from "@/lib/budgetCalculator";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { useVisitorCurrency } from "@/lib/visitorCurrency";

const FIELDS: { key: FixedField; label: string }[] = [
  { key: "income", label: "Revenus mensuels" },
  { key: "rent", label: "Loyer / Crédit" },
  { key: "insurance", label: "Assurance maladie" },
  { key: "phone", label: "Abonnement téléphonique" },
  { key: "internet", label: "Abonnement internet" },
  { key: "transport", label: "Transport" },
  { key: "leasing", label: "Leasing" },
];

const fieldClassName =
  "mt-1 w-full min-h-11 rounded-[var(--radius-card)] border border-text/10 bg-surface px-4 py-3 tabular-nums text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function parseAmount(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function BudgetCalculator() {
  const currency = useVisitorCurrency();
  const [inputs, setInputs] = useState<BudgetInputs>(EMPTY_BUDGET);
  const committed = useMemo(() => committedExpenses(inputs), [inputs]);
  const available = useMemo(() => availableToSpend(inputs), [inputs]);
  const isDeficit = available < 0;

  const setField = (key: FixedField, value: string) => {
    setInputs((current) => ({ ...current, [key]: parseAmount(value) }));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-sm font-semibold text-text">
              {field.label}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="1"
              value={inputs[field.key] || ""}
              onChange={(event) => setField(field.key, event.target.value)}
              className={fieldClassName}
            />
          </label>
        ))}
        <p className="text-sm font-semibold text-text">Ajouter d’un geste</p>
        <div className="flex flex-wrap gap-2">
          {CALCULATOR_CHIPS.map((chip) => {
            const selected = inputs.addedLines.some(
              (line) => line.id === chip.id,
            );
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setInputs((current) => toggleChip(current, chip, currency))
                }
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary bg-primary/8"
                    : "border-text/10 bg-surface hover:border-primary/40"
                }`}
              >
                +{chip.amount} {chipLabel(chip, currency)}
              </button>
            );
          })}
        </div>
        {inputs.addedLines.length > 0 ? (
          <ul className="space-y-2">
            {inputs.addedLines.map((line) => (
              <li
                key={line.id}
                className="flex items-center gap-2 rounded-[var(--radius-card)] border border-text/10 bg-surface px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-text">
                  {line.label}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={line.amount || ""}
                  aria-label={`Montant de ${line.label}`}
                  onChange={(event) =>
                    setInputs((current) =>
                      updateLineAmount(
                        current,
                        line.id,
                        parseAmount(event.target.value),
                      ),
                    )
                  }
                  className="min-h-11 w-28 rounded-[var(--radius-card)] border border-text/10 bg-surface px-3 tabular-nums text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <button
                  type="button"
                  aria-label={`Retirer ${line.label}`}
                  onClick={() =>
                    setInputs((current) => removeLine(current, line.id))
                  }
                  className="min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-text-secondary hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <div className="rounded-[var(--radius-large)] border border-text/10 bg-surface p-6 sm:p-8">
        <p className="text-sm font-semibold text-text-secondary">Disponible</p>
        <p
          className={`mt-2 text-4xl font-bold tabular-nums tracking-[-0.035em] ${isDeficit ? "text-accent" : "text-primary"}`}
        >
          {formatMoney(available, currency)}
        </p>
        <p className="mt-6 text-sm text-text-secondary">
          Revenu {formatMoney(inputs.income, currency)} · Dépenses{" "}
          {formatMoney(committed, currency)} · Disponible{" "}
          {formatMoney(available, currency)}
        </p>
        {isDeficit ? (
          <p className="mt-4 text-sm text-text-secondary">
            Pas d’inquiétude — tu pourras ajuster tout ça après.
          </p>
        ) : null}
        <Button
          href={angularUrl("/signup", "calculateur_budget", DEFAULT_LOCALE)}
          className="mt-8"
          data-cta-name="projeter_12_mois"
          data-cta-location="calculateur"
          data-cta-destination="/signup"
        >
          Projette-le sur 12 mois
        </Button>
      </div>
    </div>
  );
}
