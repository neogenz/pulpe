"use client";

import { memo, type ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  animateOnMount?: boolean;
  variant?: "default" | "blur";
}

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
