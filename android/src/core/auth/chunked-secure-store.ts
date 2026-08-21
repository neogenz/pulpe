import * as SecureStore from "expo-secure-store";

/**
 * Android backs SecureStore with SharedPreferences entries wrapped by the
 * Keystore, and Expo warns past 2048 bytes per value. A Supabase session
 * carries a JWT plus the user object and goes over that, so values are split.
 *
 * Splitting is preferred over Supabase's documented "encrypt then store
 * elsewhere" recipe because every chunk stays inside the Keystore instead of
 * landing in plain storage under a key we would have to manage ourselves.
 */
const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

async function readChunkCount(key: string): Promise<number | null> {
  const header = await SecureStore.getItemAsync(key);
  if (header === null) return null;

  const count = Number.parseInt(header, 10);
  return Number.isInteger(count) && count > 0 ? count : null;
}

async function removeChunks(key: string, count: number): Promise<void> {
  const deletions = Array.from({ length: count }, (_, index) =>
    SecureStore.deleteItemAsync(chunkKey(key, index)),
  );
  await Promise.all(deletions);
}

export const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);
    if (count === null) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    // A partially written value is unusable; report it as absent so the caller
    // re-authenticates instead of parsing a truncated session.
    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readChunkCount(key);

    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(key, String(chunks.length));

    if (previousCount !== null && previousCount > chunks.length) {
      const staleDeletions = Array.from(
        { length: previousCount - chunks.length },
        (_, index) =>
          SecureStore.deleteItemAsync(chunkKey(key, chunks.length + index)),
      );
      await Promise.all(staleDeletions);
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key);
    await SecureStore.deleteItemAsync(key);
    if (count !== null) await removeChunks(key, count);
  },
};
