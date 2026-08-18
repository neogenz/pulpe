"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { formatMoney } from "@/lib/amount";
import {
  CALCULATOR_CHIPS,
  EMPTY_BUDGET,
  availableToSpend,
  committedExpenses,
  type BudgetInputs,
} from "@/lib/budgetCalculator";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { useVisitorCurrency } from "@/lib/visitorCurrency";

const FIELDS: { key: keyof BudgetInputs; label: string }[] = [
  { key: "income", label: "Revenus mensuels" },
  { key: "rent", label: "Loyer / Crédit" },
  { key: "insurance", label: "Assurance maladie" },
  { key: "phone", label: "Abonnement téléphonique" },
  { key: "internet", label: "Abonnement internet" },
  { key: "transport", label: "Transport" },
  { key: "leasing", label: "Leasing" },
];

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

  const setField = (key: keyof BudgetInputs, value: string) => {
    setInputs((current) => ({ ...current, [key]: parseAmount(value) }));
  };

  const addChip = (field: "extra" | "savings", amount: number) => {
    setInputs((current) => ({ ...current, [field]: current[field] + amount }));
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
              className="mt-1 w-full rounded-[var(--radius-card)] border border-text/10 bg-surface px-4 py-3 tabular-nums text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        ))}
        <p className="text-sm font-semibold text-text">Ajouter d’un geste</p>
        <div className="flex flex-wrap gap-2">
          {CALCULATOR_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => addChip(chip.field, chip.amount)}
              className="min-h-11 rounded-full border border-text/10 bg-surface px-4 text-sm font-semibold text-text hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              +{chip.amount} {chip.label}
            </button>
          ))}
        </div>
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
