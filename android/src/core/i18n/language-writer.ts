import type { SupportedLocale } from "pulpe-shared";

interface LanguageWriterDependencies {
  apply: (locale: SupportedLocale) => void;
  persist: (locale: SupportedLocale) => Promise<unknown>;
  setPending: (isPending: boolean) => void;
  onConfirmed: (from: SupportedLocale, to: SupportedLocale) => void;
  onLatestError: () => void;
}

export function createLanguageWriter(
  initialLocale: SupportedLocale,
  dependencies: LanguageWriterDependencies,
) {
  let confirmedLocale = initialLocale;
  let selectedLocale = initialLocale;
  let latestRequest = 0;
  let queue = Promise.resolve();

  return {
    choose(locale: SupportedLocale): Promise<void> {
      if (locale === selectedLocale) return queue;
      selectedLocale = locale;
      const request = ++latestRequest;
      dependencies.apply(locale);
      dependencies.setPending(true);

      queue = queue.then(async () => {
        try {
          await dependencies.persist(locale);
          const previous = confirmedLocale;
          confirmedLocale = locale;
          dependencies.onConfirmed(previous, locale);
        } catch {
          if (request !== latestRequest) return;
          selectedLocale = confirmedLocale;
          dependencies.apply(confirmedLocale);
          dependencies.onLatestError();
        } finally {
          if (request === latestRequest) dependencies.setPending(false);
        }
      });
      return queue;
    },
  };
}
