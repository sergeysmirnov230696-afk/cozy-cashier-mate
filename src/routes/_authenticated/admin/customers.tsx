import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatKzt } from "@/lib/pos";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Клиенты и бонусы — управление" },
      {
        name: "description",
        content:
          "База клиентов закусочной: телефон, накопленные бонусы, число визитов и сумма покупок.",
      },
      { property: "og:title", content: "Клиенты и бонусы — управление" },
      {
        property: "og:description",
        content: "Список постоянных клиентов с бонусами, визитами и суммой покупок.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

type CustomerRow = {
  id: string;
  name: string | null;
  phone: string;
  bonus: number;
  visits: number;
  total_spent: number;
  created_at: string;
};

function CustomersPage() {
  const [q, setQ] = useState("");
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("total_spent", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as CustomerRow[];
    },
  });

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (customers.data ?? []).filter(
      (c) =>
        !term ||
        c.phone.toLowerCase().includes(term) ||
        (c.name ?? "").toLowerCase().includes(term),
    );
  }, [customers.data, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Клиенты</h1>
        <Input
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по телефону или имени"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Клиент</th>
              <th className="p-3">Телефон</th>
              <th className="p-3 text-right">Бонусы</th>
              <th className="p-3 text-right">Визитов</th>
              <th className="p-3 text-right">Куплено на</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Клиентов пока нет
                </td>
              </tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-medium">{c.name || "Без имени"}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3 text-right text-primary">{c.bonus}</td>
                <td className="p-3 text-right">{c.visits}</td>
                <td className="p-3 text-right font-semibold">{formatKzt(c.total_spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
