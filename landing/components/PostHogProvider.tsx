'use client';

import { useEffect } from 'react';
import { initPostHog, getDistinctId, CROSS_DOMAIN_PARAM } from '../lib/posthog';
import { ANGULAR_APP_URL } from '../lib/config';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!link?.href || !ANGULAR_APP_URL) return;
      if (!link.href.startsWith(ANGULAR_APP_URL)) return;

      const distinctId = getDistinctId();
      if (!distinctId) return;

      e.preventDefault();
      const url = new URL(link.href);
      url.searchParams.set(CROSS_DOMAIN_PARAM, distinctId);
      window.location.href = url.toString();
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return <>{children}</>;
}
