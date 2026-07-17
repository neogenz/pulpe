import { memo } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "organic";
}

const BASE_STYLES = "bg-surface p-6";

/* Only elevated cards lift. Tonal cards stay flat so hierarchy does not depend
   on a repeated shadow-and-hover treatment. */
const HOVER_LIFT =
  "transition-[translate,box-shadow] duration-300 [transition-timing-function:var(--ease-smooth)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] motion-reduce:transition-none motion-reduce:translate-y-0";

const VARIANT_STYLES = {
  default: "rounded-[var(--radius-card)] border border-text/5",
  elevated: `rounded-[var(--radius-card)] shadow-[var(--shadow-card)] ${HOVER_LIFT}`,
  organic:
    "rounded-[var(--radius-card)] border border-primary/15 bg-[#fbfff8] transition-[background-color,border-color] duration-200 hover:bg-surface hover:border-primary/25 motion-reduce:transition-none",
} as const;

export const Card = memo(function Card({
  children,
  variant = "default",
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(BASE_STYLES, VARIANT_STYLES[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
});
