import Image from "next/image";
import type { ReactNode } from "react";
import { Lock, Pointer } from "lucide-react";

/**
 * A simplified picture of the Google page the visitor is about to land on,
 * with the one button they need to touch. Schematic on purpose: Google
 * reworks these pages often, and a faithful screenshot would date fast.
 */
function BrowserMock({
  host,
  label,
  children,
}: {
  host: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="mx-auto w-full max-w-[20rem] overflow-hidden rounded-[var(--radius-large)] bg-white shadow-[var(--shadow-screenshot)] outline outline-1 -outline-offset-1 outline-black/5"
    >
      <div className="flex items-center justify-center gap-1.5 border-b border-black/5 bg-[#f1f3f4] px-4 py-2.5 text-xs text-text-secondary">
        <Lock className="size-3" strokeWidth={2.2} aria-hidden="true" />
        {host}
      </div>
      <div className="px-5 pb-6 pt-5">{children}</div>
    </div>
  );
}

function SkeletonLines() {
  return (
    <div aria-hidden="true" className="mt-4 space-y-2">
      <div className="h-2 w-full rounded-full bg-black/[0.06]" />
      <div className="h-2 w-4/5 rounded-full bg-black/[0.06]" />
    </div>
  );
}

/** The button to touch, ringed with the landing's marker green. */
function TargetButton({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-6 flex justify-center">
      <span className="tap-hint rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white ring-4 ring-marker-highlight-strong">
        {children}
      </span>
      <Pointer
        className="tap-hint-pointer absolute -bottom-5 left-[58%] size-7 fill-white text-text"
        strokeWidth={1.6}
        aria-hidden="true"
      />
    </div>
  );
}

export function GroupMock({
  label,
  button,
}: {
  label: string;
  button: string;
}) {
  return (
    <BrowserMock host="groups.google.com" label={label}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-surface-alt text-base font-semibold text-primary">
          P
        </span>
        <span className="text-sm font-medium text-text">
          pulpe-android-beta
        </span>
      </div>
      <SkeletonLines />
      <TargetButton>{button}</TargetButton>
    </BrowserMock>
  );
}

export function PlayMock({ label, button }: { label: string; button: string }) {
  return (
    <BrowserMock host="play.google.com" label={label}>
      <div className="flex items-center gap-3">
        <Image
          src="/icon-64.webp"
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-xl"
        />
        <span className="text-sm font-medium text-text">Pulpe</span>
      </div>
      <SkeletonLines />
      <TargetButton>{button}</TargetButton>
    </BrowserMock>
  );
}
