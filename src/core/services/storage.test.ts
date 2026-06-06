import { beforeEach, describe, expect, it } from "vitest";
import { setStorageBackend, storage, type KV } from "./storage";

function memoryBackend(): KV {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.has(key) ? (map.get(key) as T) : null;
    },
    async set<T>(key: string, value: T) {
      map.set(key, value);
    },
  };
}

describe("storage KV", () => {
  beforeEach(() => setStorageBackend(memoryBackend()));

  it("returns null for a missing key", async () => {
    expect(await storage().get("nope")).toBeNull();
  });

  it("round-trips a value", async () => {
    await storage().set("favorites", ["json", "base64"]);
    expect(await storage().get<string[]>("favorites")).toEqual([
      "json",
      "base64",
    ]);
  });
});
