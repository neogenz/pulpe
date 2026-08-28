"use client";

import { useEffect, useRef } from "react";

export interface SignatureStroke {
  d: string;
  x: number;
}

export interface SignatureData {
  width: number;
  strokes: SignatureStroke[];
}

/**
 * Handwritten signature: each stroke is a single pen path that draws itself
 * when the signature scrolls into view, like someone signing the page. Same
 * contract as ArrowNote — the final state exists without JavaScript, the
 * classes only gate the drawing animation once visibility is confirmed.
 */
export function Signature({
  name,
  data,
  delay = 0,
  className = "",
}: {
  name: string;
  data: SignatureData;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add("signature-ready");
        requestAnimationFrame(() => element.classList.add("signature-drawn"));
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox={`0 -700 ${data.width} 1220`}
      className={`signature ${className}`}
      role="img"
      aria-label={name}
      style={{ "--signature-delay": `${delay}s` } as React.CSSProperties}
    >
      {data.strokes.map((stroke, index) => (
        <path
          key={index}
          d={stroke.d}
          transform={`translate(${stroke.x},0) scale(1,-1)`}
          pathLength={1}
          vectorEffect="non-scaling-stroke"
          style={{ "--signature-order": index } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}
