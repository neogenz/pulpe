"use client";

import { useEffect, useRef } from "react";

export function ArrowNote({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    element.classList.add("arrow-note-ready");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add("arrow-note-drawn");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`arrow-note ${className}`}
    >
      <span className="arrow-note-label">Prêt à respirer&nbsp;?</span>
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
