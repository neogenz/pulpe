import { memo } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Container } from "./Container";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  background?: "default" | "surface" | "primary";
}

const BACKGROUND_STYLES = {
  default: "bg-transparent",
  surface: "bg-surface",
  primary: "bg-primary text-on-primary",
} as const;

export const Section = memo(function Section({
  children,
  background = "default",
  className = "",
  ...props
}: SectionProps) {
  return (
    <section
      className={`scroll-mt-24 py-10 lg:scroll-mt-28 lg:py-15 ${BACKGROUND_STYLES[background]} ${className}`}
      {...props}
    >
      <Container className="relative z-10">{children}</Container>
    </section>
  );
});
