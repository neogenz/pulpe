import { createMMKV } from "react-native-mmkv";
import * as z from "zod";

const KEY = "free-accounts";
const storage = createMMKV({ id: "pulpe-reconcile" });

const freeAccountsSchema = z.array(
  z.object({ name: z.string(), side: z.enum(["own", "owe"]) }),
);

export type FreeAccount = z.infer<typeof freeAccountsSchema>[number];

/**
 * The free rows of the comparison (« Revolut », « Carte Cembra ») kept on this
 * device so the next one starts with them: names and sides only, never an
 * amount, never sent to the server.
 */
export function readFreeAccounts(): FreeAccount[] {
  const stored = storage.getString(KEY);
  if (stored === undefined) return [];
  try {
    const parsed = freeAccountsSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveFreeAccounts(accounts: FreeAccount[]): void {
  storage.set(
    KEY,
    JSON.stringify(accounts.map(({ name, side }) => ({ name, side }))),
  );
}

/** The free rows belong to the account that typed them. */
export function clearFreeAccounts(): void {
  storage.remove(KEY);
}
