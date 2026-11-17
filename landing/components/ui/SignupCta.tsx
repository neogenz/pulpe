import { Button } from "./Button";
import { angularUrl, IOS_APP_URL } from "@/lib/config";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";

/**
 * The sign-up button, which on an iPhone leads to the App Store instead of the
 * web sign-up. The page is prerendered, so both buttons ship and the inline
 * head script picks one through `data-ios` before first paint: no hydration
 * mismatch, no button swapping under the visitor's thumb.
 */
export function SignupCta({
  locale,
  utmContent,
  ctaName,
  ctaLocation,
  label,
  appStoreLabel,
  className,
  ...buttonProps
}: {
  locale: Locale;
  utmContent: string;
  ctaName: string;
  ctaLocation: string;
  label: string;
  appStoreLabel: string;
  className?: string;
  glow?: boolean;
  size?: "sm" | "default";
  tabIndex?: number;
}) {
  return (
    <>
      <Button
        {...buttonProps}
        href={angularUrl("/signup", utmContent, locale)}
        className={cn("ios:hidden", className)}
        data-cta-name={ctaName}
        data-cta-location={ctaLocation}
        data-cta-destination="/signup"
      >
        {label}
      </Button>
      <Button
        {...buttonProps}
        href={IOS_APP_URL}
        className={cn("not-ios:hidden", className)}
        data-cta-name={ctaName}
        data-cta-location={ctaLocation}
        data-cta-destination={IOS_APP_URL}
      >
        {appStoreLabel}
      </Button>
    </>
  );
}
