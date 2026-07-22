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
        // Marks entering in the same batch (e.g. three columns on desktop)
        // draw one after another, top-to-bottom then left-to-right, instead
        // of all at once.
        const batch = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top ||
              a.boundingClientRect.left - b.boundingClientRect.left,
          );
        batch.forEach((entry, index) => {
          const mark = entry.target as HTMLElement;
          mark.style.animationDelay = `${0.3 + index * 0.45}s`;
          mark.classList.add("marker-highlight-drawn");
          observer.unobserve(mark);
        });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    marks.forEach((mark) => observer.observe(mark));
    return () => observer.disconnect();
  }, []);

  return null;
}
