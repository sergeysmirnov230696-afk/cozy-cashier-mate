import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { cashierMe } from "@/lib/cashier.functions";
import { isNetworkError, loadCashier, saveCashier } from "@/lib/offline-queue";
import type { CashierInfo } from "@/lib/cashier.functions";

/**
 * Проверяет PIN-сессию кассира. Кассир не пользователь базы, поэтому личность
 * подтверждает сервер по зашифрованной cookie.
 */
export function useCashier() {
  const navigate = useNavigate();
  const me = useServerFn(cashierMe);
  const query = useQuery({
    queryKey: ["cashier", "me"],
    queryFn: async () => {
      try {
        const cashier = await me();
        saveCashier(cashier);
        return cashier;
      } catch (error) {
        const cached = loadCashier<CashierInfo>();
        if (cached && isNetworkError(error)) return cached;
        throw error;
      }
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!query.isLoading && query.data === null) {
      navigate({ to: "/cashier/login", replace: true });
    }
  }, [query.isLoading, query.data, navigate]);

  return query;
}
