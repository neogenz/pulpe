import type { ComponentProps } from "react";
import { Card as PaperCard } from "react-native-paper";

import { RADIUS } from "@/core/ui/theme";

type PaperCardProps = ComponentProps<typeof PaperCard>;

/**
 * Every card in the app, at one radius.
 *
 * Paper derives a card's corner from `3 × roundness`, and the app's roundness
 * is 8 — so a Paper card came out at 24 while every card written by hand used
 * `RADIUS.card`, 18. Six points, on ten screens, next to each other: that gap
 * is the whole of the "two apps stuck together" feeling, and it is invisible
 * in any single screenshot.
 *
 * `borderRadius` in `style` wins over Paper's own, and Paper hands it down to
 * the content and the outline overlay too, so one value settles all three.
 */
export function Card({ style, ...rest }: PaperCardProps) {
  return <PaperCard {...rest} style={[{ borderRadius: RADIUS.card }, style]} />;
}

Card.Content = PaperCard.Content;
Card.Actions = PaperCard.Actions;
Card.Cover = PaperCard.Cover;
Card.Title = PaperCard.Title;
