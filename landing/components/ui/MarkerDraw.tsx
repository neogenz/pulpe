"use client";

import { useEffect } from "react";

/**
 * Adds `marker-highlight-drawn` to each `.marker-highlight` as it scrolls into
 * view, so the felt-tip stroke draws itself at that moment. Text stays fully
 * visible without JS — only the decorative stroke is gated.
 */
export function MarkerDraw() {
  useEffect(() => {
    const marks = document.querySelectorAll(".marker-highlight");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("marker-highlight-drawn");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    marks.forEach((mark) => observer.observe(mark));
    return () => observer.disconnect();
  }, []);

  return null;
}
