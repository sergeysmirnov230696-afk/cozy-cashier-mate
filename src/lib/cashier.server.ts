import type { SupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Кассирская смена работает без e-mail входа: кассир выбирает себя и вводит PIN.
 * Личность кассира хранится в зашифрованной cookie-сессии, а все обращения к
 * базе идут через сервер, поэтому планшет кассира не получает прав на базу.
 */

export type CashierSessionData = {
  employeeId?: string;
  name?: string;
  role?: string;
  loginAt?: string;
};

const SESSION_MAX_AGE = 60 * 60 * 24; // 24 часа

function sessionConfig() {
  return {
    password: process.env["CASHIER_SESSION_SECRET"]!,
    name: "cashier-session",
    maxAge: SESSION_MAX_AGE,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

// Нетипизированный клиент: схема меняется миграциями, а сервер работает с
// простыми объектами и сам собирает ответы для интерфейса.
export const db = supabaseAdmin as unknown as SupabaseClient;

export async function cashierSession() {
  return useSession<CashierSessionData>(sessionConfig());
}

export type Cashier = {
  id: string;
  name: string;
  role: string;
  loginAt: string;
};

export async function readCashier(): Promise<Cashier | null> {
  const session = await cashierSession();
  const { employeeId, name, role, loginAt } = session.data;
  if (!employeeId || !loginAt) return null;

  // Сессия живёт максимум 24 часа
  if (Date.now() - new Date(loginAt).getTime() > SESSION_MAX_AGE * 1000) {
    await session.clear();
    return null;
  }

  const { data: employee } = await db
    .from("employees")
    .select("id, name, role, is_active")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee || employee.is_active === false) {
    await session.clear();
    return null;
  }

  return {
    id: employeeId,
    name: employee.name ?? name ?? "",
    role: employee.role ?? role ?? "cashier",
    loginAt,
  };
}

export async function requireCashier(): Promise<Cashier> {
  const cashier = await readCashier();
  if (!cashier) throw new Error("Сессия кассира истекла. Войдите заново.");
  return cashier;
}

/** Закрывает смены, которые висят открытыми дольше 24 часов. */
export async function closeExpiredShifts(): Promise<void> {
  await db.rpc("close_expired_shifts");
}

export async function openShiftRow() {
  await closeExpiredShifts();
  const { data } = await db
    .from("shifts")
    .select("*")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function logAction(
  cashier: { id: string; name: string } | null,
  action: string,
  entity: string | null,
  entityId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await db.from("audit_log").insert({
    employee_id: cashier?.id ?? null,
    employee_name: cashier?.name ?? null,
    action,
    entity,
    entity_id: entityId,
    details,
  });
}

export async function getSettingsRow() {
  const { data } = await db.from("settings").select("*").limit(1).maybeSingle();
  return data;
}
