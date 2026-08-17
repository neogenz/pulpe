import { readFileSync } from "@/core/testing/source-files";

const mutationSources = [
  "src/features/transactions/transaction-mutations.ts",
  "src/features/budget-details/savings-withdrawal/withdrawal-mutations.ts",
];

describe("goal cache invalidation", () => {
  it.each(mutationSources)("refreshes goals after writes in %s", (path) => {
    const source = readFileSync(path, "utf8");

    expect(source).toContain("queryKey: goalKeys.all");
  });
});
