import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Журнал действий кассиров" },
      {
        name: "description",
        content:
          "История действий: входы кассиров, открытие и закрытие смен, отмены заказов и операции с наличными.",
      },
      { property: "og:title", content: "Журнал действий кассиров" },
      {
        property: "og:description",
        content: "Кто и когда открывал смену, отменял заказ или вносил деньги в кассу.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

type AuditRow = {
  id: string;
  created_at: string;
  employee_name: string | null;
  action: string;
  entity: string | null;
  details: unknown;
};

const ACTIONS: Record<string, string> = {
  login: "Вход кассира",
  logout: "Выход кассира",
  shift_open: "Смена открыта",
  shift_close: "Смена закрыта",
  order_create: "Заказ создан",
  order_completed: "Заказ выполнен",
  order_cancelled: "Заказ отменён",
  cash_in: "Внесение в кассу",
  cash_out: "Изъятие из кассы",
};

function AuditPage() {
  const log = useQuery({
    queryKey: ["audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AuditRow[];
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Журнал действий</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Время</th>
              <th className="p-3">Сотрудник</th>
              <th className="p-3">Действие</th>
              <th className="p-3">Детали</th>
            </tr>
          </thead>
          <tbody>
            {(log.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  Записей пока нет
                </td>
              </tr>
            )}
            {(log.data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString("ru-RU")}
                </td>
                <td className="p-3">{r.employee_name || "—"}</td>
                <td className="p-3">{ACTIONS[r.action] ?? r.action}</td>
                <td className="max-w-[420px] truncate p-3 text-muted-foreground">
                  {r.details ? JSON.stringify(r.details) : (r.entity ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
