import { Fragment, type ReactElement } from "react";

import { useAmountVisibility } from "./amount-visibility";

/**
 * Remounts a screen when amounts are hidden or shown.
 *
 * The formatters read the mask as a global, and the React Compiler memoizes
 * each `formatX(value, currency)` call on its two arguments alone — so in a
 * compiled build a screen that re-rendered on the toggle got its cached,
 * unmasked strings back and kept printing a salary the user had just asked to
 * hide. A screen cannot be told to forget its memo cache; it can be mounted
 * again, and a toggle made from the settings is the one moment that costs
 * nothing to look at.
 *
 * Applied once per navigator, through `screenLayout`, rather than asked of each
 * screen: a screen that forgot would be the one leaking amounts.
 */
export function AmountMaskBoundary({ children }: { children: ReactElement }) {
  const areAmountsHidden = useAmountVisibility(
    (state) => state.areAmountsHidden,
  );

  return (
    <Fragment key={areAmountsHidden ? "masked" : "shown"}>{children}</Fragment>
  );
}
