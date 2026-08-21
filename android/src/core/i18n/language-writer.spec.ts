import type { SupportedLocale } from "pulpe-shared";

import { createLanguageWriter } from "./language-writer";

function deferred() {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
}

describe("language writer", () => {
  it("applies immediately and serializes rapid writes", async () => {
    const first = deferred();
    const second = deferred();
    const writes: SupportedLocale[] = [];
    const applied: SupportedLocale[] = [];
    const confirmed: string[] = [];
    const pending = jest.fn();
    const writer = createLanguageWriter("fr", {
      apply: (locale) => applied.push(locale),
      persist: (locale) => {
        writes.push(locale);
        return writes.length === 1 ? first.promise : second.promise;
      },
      onConfirmed: (from, to) => confirmed.push(`${from}-${to}`),
      onLatestError: jest.fn(),
      setPending: pending,
    });

    const english = writer.choose("en");
    const german = writer.choose("de");
    await Promise.resolve();
    expect(applied).toEqual(["en", "de"]);
    expect(writes).toEqual(["en"]);
    expect(confirmed).toEqual([]);

    first.resolve();
    await english;
    expect(writes).toEqual(["en", "de"]);
    second.resolve();
    await german;
    expect(confirmed).toEqual(["fr-en", "en-de"]);
    expect(pending.mock.calls).toEqual([[true], [true], [false]]);
  });

  it("ignores an older failure when a newer choice is queued", async () => {
    const failed = deferred();
    const errors = jest.fn();
    const applied: SupportedLocale[] = [];
    const writer = createLanguageWriter("fr", {
      apply: (locale) => applied.push(locale),
      persist: (locale) =>
        locale === "en" ? failed.promise : Promise.resolve(),
      onConfirmed: jest.fn(),
      onLatestError: errors,
      setPending: jest.fn(),
    });

    const english = writer.choose("en");
    const italian = writer.choose("it");
    failed.reject();
    await english;
    await italian;

    expect(applied).toEqual(["en", "it"]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("rolls the latest failure back to the last confirmed locale", async () => {
    const applied: SupportedLocale[] = [];
    const errors = jest.fn();
    const writer = createLanguageWriter("fr", {
      apply: (locale) => applied.push(locale),
      persist: async () => {
        throw new Error("offline");
      },
      onConfirmed: jest.fn(),
      onLatestError: errors,
      setPending: jest.fn(),
    });

    await writer.choose("de");

    expect(applied).toEqual(["de", "fr"]);
    expect(errors).toHaveBeenCalledTimes(1);
  });
});
