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

function dependencies(persist: (locale: SupportedLocale) => Promise<unknown>) {
  return {
    apply: jest.fn(),
    current: () => "fr" as const,
    onConfirmed: jest.fn(),
    onLatestError: jest.fn(),
    persist,
    setPending: jest.fn(),
  };
}

describe("language writer", () => {
  it("applies immediately, serializes writes, and confirms afterward", async () => {
    const first = deferred();
    const writes: SupportedLocale[] = [];
    const deps = dependencies((locale) => {
      writes.push(locale);
      return locale === "en" ? first.promise : Promise.resolve();
    });
    const writer = createLanguageWriter();

    const english = writer.choose("en", deps);
    const german = writer.choose("de", deps);
    await Promise.resolve();
    expect(writes).toEqual(["en"]);
    expect(deps.onConfirmed).not.toHaveBeenCalled();

    first.resolve();
    await english;
    await german;
    expect(deps.onConfirmed).toHaveBeenNthCalledWith(1, "fr", "en", undefined);
    expect(deps.onConfirmed).toHaveBeenNthCalledWith(2, "en", "de", undefined);
    expect(deps.setPending.mock.calls).toEqual([[true], [true], [false]]);
  });

  it("keeps a reopened screen's newer choice when the old write fails", async () => {
    const oldWrite = deferred();
    const oldScreen = dependencies(() => oldWrite.promise);
    const newScreen = dependencies(() => Promise.resolve());
    const writer = createLanguageWriter();

    const english = writer.choose("en", oldScreen);
    const german = writer.choose("de", newScreen);
    oldWrite.reject();
    await english;
    await german;

    expect(oldScreen.apply).toHaveBeenCalledWith("en");
    expect(newScreen.apply).toHaveBeenCalledWith("de");
  });

  it("ignores a late rejection after account teardown", async () => {
    const write = deferred();
    let snapshot: SupportedLocale | undefined = "fr";
    const deps = dependencies(() => write.promise);
    deps.apply.mockImplementation((locale) => {
      snapshot = locale;
    });
    const writer = createLanguageWriter();

    const pending = writer.choose("it", deps);
    await Promise.resolve();
    writer.invalidate();
    snapshot = undefined;
    write.reject();
    await pending;

    expect(snapshot).toBeUndefined();
    expect(deps.onConfirmed).not.toHaveBeenCalled();
    expect(deps.setPending).not.toHaveBeenLastCalledWith(false);
  });
});
