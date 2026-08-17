"use client";

import { useEffect, useRef } from "react";

export function ArrowNote({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // `arrow-note-ready` masque le libellé et efface la flèche : il ne peut donc
    // être posé qu'une fois la note confirmée à l'écran, jamais au montage.
    // Sinon un IntersectionObserver qui ne se déclenche pas — onglet en arrière-
    // plan, rendu sans peinture — laisse « Prêt à respirer ? » invisible pour de
    // bon. L'état par défaut reste la note visible, l'animation l'enrichit.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add("arrow-note-ready");
        requestAnimationFrame(() => element.classList.add("arrow-note-drawn"));
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={`arrow-note ${className}`}>
      <span className="arrow-note-label">{label}</span>
      <svg
        className="arrow-note-svg"
        viewBox="0 0 112 84"
        fill="none"
        role="presentation"
      >
        <path
          className="arrow-note-path"
          pathLength={1}
          d="M 102 5 C 98 34, 78 65, 22 72"
        />
        <path
          className="arrow-note-path arrow-note-head"
          pathLength={1}
          d="M 35 61 C 30 65, 25 69, 22 72 C 27 74, 32 78, 36 82"
        />
      </svg>
    </div>
  );
}
