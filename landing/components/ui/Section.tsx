import { memo } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Container } from "./Container";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  background?: "default" | "primary";
}

const BACKGROUND_STYLES = {
  default: "bg-transparent",
  primary: "bg-primary text-white",
} as const;

export const Section = memo(function Section({
  children,
  background = "default",
  className = "",
  ...props
}: SectionProps) {
  return (
    <section
      className={`py-20 lg:py-30 ${BACKGROUND_STYLES[background]} ${className}`}
      {...props}
    >
      <Container className="relative z-10">{children}</Container>
    </section>
  );
});
