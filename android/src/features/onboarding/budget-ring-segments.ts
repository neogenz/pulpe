export interface RingArc {
  /** Fractions of the full turn, from 12 o'clock, clockwise. */
  start: number;
  end: number;
}

export interface RingGeometry {
  charges: RingArc;
  savings: RingArc;
  rest: RingArc;
  /** How much of a turn the spending runs past the income, 0 when it does not. */
  overrun: number;
}

/**
 * The ring spans the income, or what is spent when that goes past it — so an
 * overrun still draws a full ring and the excess is what the coral arc says.
 * Mirrors `OnboardingBudgetRing.swift`.
 */
export function ringGeometry(
  income: number,
  charges: number,
  savings: number,
): RingGeometry {
  const span = Math.max(income, charges + savings);
  const fraction = (value: number) => (span > 0 ? value / span : 0);

  const chargesEnd = fraction(charges);
  const savingsEnd = chargesEnd + fraction(savings);
  const restEnd = span > 0 ? 1 : 0;

  return {
    charges: { start: 0, end: chargesEnd },
    savings: { start: chargesEnd, end: savingsEnd },
    rest: { start: savingsEnd, end: restEnd },
    overrun: fraction(Math.max(0, charges + savings - income)),
  };
}
