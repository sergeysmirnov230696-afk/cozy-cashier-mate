import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { KaspiPayload, KaspiResult } from "@/lib/kaspi.server";

export type { KaspiResult, KaspiPayload };

/**
 * Отправляет чек на Kaspi Касса (терминал Kaspi Pay) для фискализации.
 * Возвращает номер фискального чека и ссылку для QR-кода.
 */
export const fiscalizeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: KaspiPayload) => input)
  .handler(async ({ data, context }): Promise<KaspiResult> => {
    const { fiscalize } = await import("@/lib/kaspi.server");
    return fiscalize(context.supabase, data);
  });
