import { LazyStore } from "@tauri-apps/plugin-store";

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

let backend: KV | null = null;

export function setStorageBackend(kv: KV): void {
  backend = kv;
}

function tauriBackend(): KV {
  const store = new LazyStore("toolkit.json");
  return {
    async get<T>(key: string) {
      return ((await store.get<T>(key)) ?? null) as T | null;
    },
    async set<T>(key: string, value: T) {
      await store.set(key, value);
      await store.save();
    },
  };
}

function browserBackend(): KV {
  return {
    async get<T>(key: string) {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async set<T>(key: string, value: T) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Reflect.has(window, "__TAURI_INTERNALS__");
}

export function storage(): KV {
  if (!backend) backend = isTauriRuntime() ? tauriBackend() : browserBackend();
  return backend;
}
