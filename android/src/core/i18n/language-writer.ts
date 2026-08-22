import type { SupportedLocale } from "pulpe-shared";

interface LanguageWriterDependencies<Result> {
  apply: (locale: SupportedLocale) => void;
  current: () => SupportedLocale;
  persist: (locale: SupportedLocale) => Promise<Result>;
  setPending: (isPending: boolean) => void;
  onConfirmed: (
    from: SupportedLocale,
    to: SupportedLocale,
    settings: Result,
  ) => void;
  onLatestError: () => void;
}

export function createLanguageWriter() {
  let generation = 0;
  let confirmedLocale: SupportedLocale | undefined;
  let selectedLocale: SupportedLocale | undefined;
  let latestRequest = 0;
  let queue = Promise.resolve();

  return {
    choose<Result>(
      locale: SupportedLocale,
      dependencies: LanguageWriterDependencies<Result>,
    ): Promise<void> {
      confirmedLocale ??= dependencies.current();
      selectedLocale ??= confirmedLocale;
      if (locale === selectedLocale) return queue;
      selectedLocale = locale;
      const request = ++latestRequest;
      const operationGeneration = generation;
      dependencies.apply(locale);
      dependencies.setPending(true);

      queue = queue.then(async () => {
        try {
          const settings = await dependencies.persist(locale);
          if (operationGeneration !== generation) return;
          const previous = confirmedLocale ?? dependencies.current();
          confirmedLocale = locale;
          dependencies.onConfirmed(previous, locale, settings);
        } catch {
          if (operationGeneration !== generation || request !== latestRequest)
            return;
          const rollback = confirmedLocale ?? dependencies.current();
          selectedLocale = rollback;
          dependencies.apply(rollback);
          dependencies.onLatestError();
        } finally {
          if (operationGeneration === generation && request === latestRequest)
            dependencies.setPending(false);
        }
      });
      return queue;
    },
    invalidate(): void {
      generation += 1;
      confirmedLocale = undefined;
      selectedLocale = undefined;
      queue = Promise.resolve();
    },
    synchronize(locale: SupportedLocale): void {
      confirmedLocale = selectedLocale = locale;
    },
  };
}

export const languageWriter = createLanguageWriter();
