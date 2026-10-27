// Офлайн-очередь продаж: хранится в браузере кассы и отправляется на сервер при появлении связи.
import type { CreateOrderInputLike } from "./offline-types";

const QUEUE_KEY = "pos-offline-queue";
const CATALOG_KEY = "pos-offline-catalog";
const COUNTER_KEY = "pos-offline-counter";

export type QueuedOrder = { localId: string; localNo: number; createdAt: string; payload: CreateOrderInputLike; error?: string };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getQueue(): QueuedOrder[] {
  return read<QueuedOrder[]>(QUEUE_KEY, []);
}

export function enqueueOrder(payload: CreateOrderInputLike): QueuedOrder {
  const existing = getQueue().find((q) => q.localId === payload.clientOrderId);
  if (existing) return existing;
  const localNo = read<number>(COUNTER_KEY, 0) + 1;
  write(COUNTER_KEY, localNo);
  const item: QueuedOrder = {
    localId: payload.clientOrderId ?? crypto.randomUUID(),
    localNo,
    createdAt: new Date().toISOString(),
    payload,
  };
  item.payload = { ...payload, clientOrderId: item.localId };
  write(QUEUE_KEY, [...getQueue(), item]);
  window.dispatchEvent(new Event("pos-queue-changed"));
  return item;
}

export function markQueueError(localId: string, error: string) {
  write(QUEUE_KEY, getQueue().map((q) => q.localId === localId ? { ...q, error } : q));
  window.dispatchEvent(new Event("pos-queue-changed"));
}

// Cached identity only keeps the offline screen available; the server still authenticates every upload.
export function saveCashier<T>(cashier: T | null) { write("pos-offline-cashier", cashier); }
export function loadCashier<T extends { loginAt: string }>(): T | null {
  const cached = read<T | null>("pos-offline-cashier", null);
  if (!cached || !Number.isFinite(Date.parse(cached.loginAt)) || Date.now() - Date.parse(cached.loginAt) >= 86_400_000) return null;
  return cached;
}

export function removeQueued(localId: string) {
  write(QUEUE_KEY, getQueue().filter((q) => q.localId !== localId));
  window.dispatchEvent(new Event("pos-queue-changed"));
}

export function saveCatalog(data: unknown) {
  try {
    write(CATALOG_KEY, data);
  } catch {
    // переполнение хранилища — не критично
  }
}

export function loadCatalog<T>(): T | undefined {
  return read<T | undefined>(CATALOG_KEY, undefined);
}

/** Ошибка связи (а не отказ сервера по бизнес-правилу). */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg);
}
