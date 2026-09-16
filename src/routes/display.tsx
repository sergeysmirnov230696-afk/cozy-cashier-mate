import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicOrderBoard } from "@/lib/cashier.functions";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "Табло заказов для зала" },
      {
        name: "description",
        content: "Экран для гостей: номера заказов, которые готовятся и уже готовы к выдаче.",
      },
      { property: "og:title", content: "Табло заказов для зала" },
      { property: "og:description", content: "Номера заказов: готовится и готово." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisplayBoard,
});

function DisplayBoard() {
  const board = useServerFn(publicOrderBoard);
  const { data } = useQuery({
    queryKey: ["order-board"],
    queryFn: () => board(),
    refetchInterval: 5_000,
  });

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <h1 className="text-center text-3xl font-bold">{data?.shopName ?? "Заказы"}</h1>
      <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2">
        <Column title="Готовится" numbers={data?.cooking ?? []} tone="muted" />
        <Column title="Готово" numbers={data?.ready ?? []} tone="primary" />
      </div>
    </main>
  );
}

function Column({
  title,
  numbers,
  tone,
}: {
  title: string;
  numbers: number[];
  tone: "muted" | "primary";
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-center text-xl font-semibold">{title}</h2>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {numbers.length === 0 && <p className="text-muted-foreground">—</p>}
        {numbers.map((n) => (
          <span
            key={n}
            className={`flex min-w-20 justify-center rounded-2xl px-4 py-3 text-4xl font-bold ${
              tone === "primary"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    </section>
  );
}
