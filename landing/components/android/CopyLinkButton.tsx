"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui";

/** Copies this page's address, for a visitor who has to reopen it in Chrome. */
export function CopyLinkButton({
  label,
  copiedLabel,
}: {
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const href = window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some in-app browsers refuse the clipboard: hand the address over instead.
      window.prompt(label, href);
    }
  };

  const Icon = copied ? Check : Link2;
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={copy}
      className="gap-2"
      data-cta-name="android_beta_copy_link"
      data-cta-location="android_in_app"
      data-cta-destination=""
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
