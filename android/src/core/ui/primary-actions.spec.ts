import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A screen's main action sits where it can be read: a labelled pill in the
 * content (`Ajouter une opération`, `Ajouter une prévision`), pinned to the
 * bottom edge on a page (`Noter un montant`), or an icon in the app bar on a
 * root list — the placements iOS uses for the same actions.
 *
 * Floating action buttons covered the last row of every list, needed a
 * clearance every list had to remember, and drew over the very snackbars that
 * offered "Annuler". None is left, and none should come back by accident.
 */
describe("primary actions", () => {
  it("never float over the content", () => {
    const floating = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return /<FAB[\s.>]/.test(source);
    });

    expect(floating).toEqual([]);
  });
});
