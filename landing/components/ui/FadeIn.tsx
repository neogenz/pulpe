"use client";

import { memo, type ReactNode } from "react";

interface BaseFadeInProps {
  children: ReactNode;
  className?: string;
}

type FadeInProps = BaseFadeInProps &
  (
    | {
        animateOnMount: true;
        delay?: number;
        variant?: "default" | "blur";
      }
    | {
        animateOnMount?: false;
        delay?: never;
        variant?: never;
      }
  );

export const FadeIn = memo(function FadeIn({
  children,
  delay = 0,
  className = "",
  animateOnMount = false,
  variant = "default",
}: FadeInProps) {
  if (animateOnMount) {
    const animationClass =
      variant === "blur" ? "animate-blur-in" : "animate-fade-in";
    return (
      <div
        className={`${animationClass} ${className}`}
        style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
      >
        {children}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
});
