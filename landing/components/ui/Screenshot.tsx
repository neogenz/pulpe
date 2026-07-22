"use client";

import {
  memo,
  useCallback,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Maximize2 } from "lucide-react";
import { useImageLightbox } from "@/contexts/useImageLightbox";

interface ScreenshotProps {
  src?: string;
  desktopSrc?: string;
  label: string;
  className?: string;
  isLCP?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  /** Intrinsic size of the mobile asset (portrait). Reserves the box < 768px. */
  mobileWidth?: number;
  mobileHeight?: number;
  /** Intrinsic size of the desktop asset (landscape). Reserves the box >= 768px.
      Defaults to the mobile size when omitted (same aspect at every breakpoint). */
  desktopWidth?: number;
  desktopHeight?: number;
  desktopAspectRatio?: string;
  fit?: "cover" | "contain";
}

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";
const MOBILE_IMAGE_WIDTH = 750;
const TABLET_IMAGE_WIDTH = 1548;

function toWebP(path: string): string {
  return path.replace(/\.png$/, ".webp");
}

function toMobileWebP(path: string): string {
  return path.replace("/responsive/", "/mobile/").replace(/\.png$/, ".webp");
}

function subscribeToMediaQuery(callback: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getIsDesktop() {
  return typeof window !== "undefined"
    ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches
    : false;
}

function getServerSnapshot() {
  return false;
}

export const Screenshot = memo(function Screenshot({
  src,
  desktopSrc,
  label,
  className = "",
  isLCP = false,
  fetchPriority,
  mobileWidth = 750,
  mobileHeight = 1190,
  desktopWidth,
  desktopHeight,
  desktopAspectRatio,
  fit = "cover",
}: ScreenshotProps) {
  const { openLightbox } = useImageLightbox();
  const isDesktop = useSyncExternalStore(
    subscribeToMediaQuery,
    getIsDesktop,
    getServerSnapshot,
  );

  const handleClick = useCallback(() => {
    if (!src) return;
    const imageSrc = isDesktop && desktopSrc ? toWebP(desktopSrc) : toWebP(src);
    openLightbox(imageSrc, label);
  }, [src, desktopSrc, label, isDesktop, openLightbox]);

  // Reserve the correct box at each breakpoint so the landscape desktop asset
  // and the portrait mobile asset never cause a decode-time layout shift (CLS).
  const frameStyle = {
    "--m-ar": `${mobileWidth} / ${mobileHeight}`,
    "--d-ar":
      desktopAspectRatio ??
      `${desktopWidth ?? mobileWidth} / ${desktopHeight ?? mobileHeight}`,
  } as CSSProperties;

  if (src) {
    const mobileWebP = toMobileWebP(src);
    const tabletWebP = toWebP(src);
    const mobileSrcSet = `${mobileWebP} ${MOBILE_IMAGE_WIDTH}w, ${tabletWebP} ${TABLET_IMAGE_WIDTH}w`;

    return (
      <button
        type="button"
        onClick={handleClick}
        style={frameStyle}
        className={`screenshot-frame group relative block w-full cursor-pointer overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-screenshot)] outline outline-1 -outline-offset-1 outline-black/10 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:translate-y-0 ${fit === "contain" ? "bg-surface-alt" : ""}`}
        aria-label={`Agrandir : ${label}`}
      >
        <picture>
          {desktopSrc && (
            <source
              media="(min-width: 768px)"
              srcSet={toWebP(desktopSrc)}
              type="image/webp"
            />
          )}
          <source
            srcSet={mobileSrcSet}
            sizes="(max-width: 767px) 100vw, 50vw"
            type="image/webp"
          />
          {desktopSrc && (
            <source media="(min-width: 768px)" srcSet={desktopSrc} />
          )}
          <img
            src={mobileWebP}
            alt={label}
            width={mobileWidth}
            height={mobileHeight}
            loading={isLCP ? "eager" : "lazy"}
            fetchPriority={fetchPriority}
            className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
          />
        </picture>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none motion-reduce:transition-none">
          <span className="bg-black/50 backdrop-blur-sm rounded-full p-3">
            <Maximize2 className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      style={frameStyle}
      className={`screenshot-frame bg-surface-alt rounded-[var(--radius-card)] outline outline-1 -outline-offset-1 outline-black/10 flex items-center justify-center text-text-secondary text-sm font-medium ${className}`}
      role="img"
      aria-label={label}
    >
      [Screenshot: {label}]
    </div>
  );
});
