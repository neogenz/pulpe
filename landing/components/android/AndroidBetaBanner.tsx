"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { AndroidMark } from "./AndroidMark";
import type { Dictionary } from "@/content/dictionary";
import { ANDROID_BETA_DISMISSED_KEY } from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import { ANDROID_ROUTE, localizedPath } from "@/lib/routes";

/**
 * The closed-test invitation, for Android visitors only. Prerendered hidden:
 * the head script flags Android (and a past dismissal) before first paint, so
 * nobody else ever sees it and nothing moves once the page is up. It does not
 * replace the sign-up buttons, which keep pointing at the web app.
 */
export function AndroidBetaBanner({
  dict,
  locale,
}: {
  dict: Dictionary["androidBeta"]["banner"];
  locale: Locale;
}) {
  const href = localizedPath(locale, ANDROID_ROUTE);

  const dismiss = () => {
    try {
      localStorage.setItem(ANDROID_BETA_DISMISSED_KEY, "1");
    } catch {
      // Private mode or blocked storage: the banner still closes for this visit.
    }
    document.documentElement.setAttribute("data-android-beta-dismissed", "");
  };

  return (
    <aside
      aria-label={dict.ariaLabel}
      className="mx-auto mb-9 hidden w-full max-w-md items-center gap-1 rounded-[var(--radius-card)] bg-surface p-1.5 text-left shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-primary/10 android-beta-invite:flex"
    >
      <Link
        href={href}
        className="group flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-200 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
        data-cta-name="android_beta_banner"
        data-cta-location="home_banner"
        data-cta-destination={ANDROID_ROUTE}
      >
        <span className="min-w-0 flex-1 text-sm leading-snug">
          <span className="flex items-center gap-1.5 font-semibold text-text">
            <AndroidMark className="size-4 shrink-0 text-primary" />
            {dict.title}
          </span>
          <span className="block text-text-secondary">{dict.text}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-[scale] duration-200 group-active:scale-[0.96] motion-reduce:transition-none">
          {dict.cta}
          <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={dict.dismiss}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-text/5 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
        data-cta-name="android_beta_banner_dismiss"
        data-cta-location="home_banner"
        data-cta-destination=""
      >
        <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </aside>
  );
}
