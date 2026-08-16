import { readFileSync, sourceFiles } from "@/core/testing/source-files";

const RAW_ERROR = /<HelperText[^>]*type="error"/;

/**
 * A field error announces itself or it does not exist.
 *
 * TalkBack reads a live region when it changes and stays silent otherwise, so
 * a `HelperText` written by hand tells a sighted user why the form was refused
 * and tells a screen-reader user nothing at all — the same screen, no sound,
 * which is indistinguishable from a submit that never fired. It went unnoticed
 * for twenty-three of the twenty-eight because the five that were right looked
 * exactly like the ones that were wrong.
 *
 * `FieldError` carries the region. `type="info"` stays Paper's, and is scoped
 * out here on purpose: a hint nobody is waiting on has no reason to interrupt.
 */
describe("field errors", () => {
  it("come from FieldError, never from HelperText directly", () => {
    const raw = sourceFiles("src")
      .filter((path) => !path.endsWith("core/ui/field-error.tsx"))
      .filter((path) => RAW_ERROR.test(readFileSync(path, "utf8")));

    expect(raw).toEqual([]);
  });
});
