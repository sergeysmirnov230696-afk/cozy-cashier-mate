import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, ShoppingCart, Settings2, LogIn, ArrowUpRight } from "lucide-react";
import chickenImage from "@/assets/product-chicken.jpg";
import donerImage from "@/assets/product-doner.jpg";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "POS-система для куры гриль и донеров" },
      {
        name: "description",
        content:
          "Касса для продавца и панель управления точкой быстрого питания: товары, склад, смены и отчёты в тенге.",
      },
      { property: "og:title", content: "POS-система для куры гриль и донеров" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Продажи, расчёт сдачи, склад, смены и отчёты — всё в одном приложении.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-5 py-12">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Flame className="size-6" />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">РАБОЧЕЕ ПРОСТРАНСТВО</p>
            <h1 className="mt-1 text-3xl font-extrabold">Гриль &amp; Донер</h1>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            to="/cashier"
            className="tile-press group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img src={donerImage} alt="Донер" className="aspect-[2/1] w-full object-cover" />
            <div className="flex items-center gap-3 p-5"><ShoppingCart className="size-6 text-primary" /><h2 className="text-xl font-bold">Касса</h2><ArrowUpRight className="ml-auto size-5 text-primary" /></div>
          </Link>
          <Link
            to="/admin"
            className="tile-press group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img src={chickenImage} alt="Курица гриль" className="aspect-[2/1] w-full object-cover" />
            <div className="flex items-center gap-3 p-5"><Settings2 className="size-6 text-accent" /><h2 className="text-xl font-bold">Управление</h2><ArrowUpRight className="ml-auto size-5 text-accent" /></div>
          </Link>
        </div>

        {!loading && !session && (
          <div className="mt-10">
            <Button asChild size="lg">
              <Link to="/auth">
                <LogIn className="size-4" /> Войти в систему
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
