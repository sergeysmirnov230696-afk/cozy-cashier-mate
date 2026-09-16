import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { cashierLogin, cashierMe, listCashiers } from "@/lib/cashier.functions";
import { ROLE_LABELS } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/cashier/login")({
  head: () => ({
    meta: [
      { title: "Вход кассира по PIN-коду" },
      {
        name: "description",
        content: "Кассир выбирает себя в списке и вводит PIN-код, чтобы начать продажи.",
      },
      { property: "og:title", content: "Вход кассира по PIN-коду" },
      { property: "og:description", content: "Быстрый вход на кассу без пароля и почты." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CashierLogin,
});

function CashierLogin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const load = useServerFn(listCashiers);
  const me = useServerFn(cashierMe);
  const login = useServerFn(cashierLogin);

  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const cashiers = useQuery({ queryKey: ["cashiers", "list"], queryFn: () => load() });
  const session = useQuery({ queryKey: ["cashier", "me"], queryFn: () => me() });

  useEffect(() => {
    if (session.data) navigate({ to: "/cashier", replace: true });
  }, [session.data, navigate]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Выберите кассира");
      if (pin.length < 4) throw new Error("Введите PIN-код");
      return login({ data: { employeeId: selected, pin } });
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        setPin("");
        toast.error(res.message);
        await qc.invalidateQueries({ queryKey: ["cashiers", "list"] });
        return;
      }
      await qc.invalidateQueries({ queryKey: ["cashier", "me"] });
      toast.success(`Смена: ${res.name}`);
      navigate({ to: "/cashier", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = cashiers.data ?? [];
  const active = list.find((c) => c.id === selected) ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold">Вход на кассу</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Выберите себя и введите PIN-код
        </p>

        <div className="mt-6 grid gap-2">
          {list.map((c) => {
            const locked = c.lockedUntil && new Date(c.lockedUntil).getTime() > Date.now();
            return (
              <button
                key={c.id}
                disabled={!!locked}
                onClick={() => {
                  setSelected(c.id);
                  setPin("");
                }}
                className={`tile-press flex items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                  selected === c.id ? "border-primary bg-primary/10" : "border-border bg-card"
                } ${locked ? "opacity-40" : ""}`}
              >
                {locked ? (
                  <Lock className="size-5 text-muted-foreground" />
                ) : (
                  <User className="size-5 text-primary" />
                )}
                <span className="font-medium">{c.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {locked ? "заблокирован" : (ROLE_LABELS[c.role] ?? c.role)}
                </span>
              </button>
            );
          })}
          {cashiers.isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">Загрузка…</p>
          )}
        </div>

        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          type="password"
          placeholder="PIN"
          disabled={!active}
          className="mt-4 text-center text-2xl tracking-[0.5em]"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((k) => (
            <Button
              key={k}
              variant="secondary"
              size="lg"
              disabled={!active}
              onClick={() =>
                setPin((p) => (k === "C" ? "" : k === "←" ? p.slice(0, -1) : (p + k).slice(0, 6)))
              }
            >
              {k}
            </Button>
          ))}
        </div>

        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={!active || pin.length < 4 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Войти
        </Button>

        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link to="/">
            <ArrowLeft className="size-4" /> На главную
          </Link>
        </Button>
      </div>
    </main>
  );
}
