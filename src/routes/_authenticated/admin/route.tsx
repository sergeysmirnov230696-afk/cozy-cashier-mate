import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  LogOut,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  Flame,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Отчёты", icon: BarChart3 },
  { to: "/admin/products", label: "Товары", icon: Package },
  { to: "/admin/stock", label: "Склад", icon: Boxes },
  { to: "/admin/orders", label: "Чеки и смены", icon: ShoppingCart },
  { to: "/admin/customers", label: "Клиенты", icon: Users },
  { to: "/admin/employees", label: "Сотрудники", icon: Users },
  { to: "/admin/audit", label: "Журнал", icon: ScrollText },
  { to: "/admin/settings", label: "Настройки", icon: Settings },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = NAV.find((item) => item.to === pathname.replace(/\/$/, "")) ?? NAV[0];

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link to="/" className="flex items-center gap-3 border-b border-sidebar-border px-5 py-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Flame className="size-5" /></span>
          <span><span className="block text-base font-extrabold">Гриль &amp; Донер</span><span className="text-xs text-muted-foreground">Управление точкой</span></span>
        </Link>
        <p className="px-5 pt-6 pb-3 text-xs font-semibold text-muted-foreground">РАБОЧЕЕ ПРОСТРАНСТВО</p>
        <nav aria-label="Разделы управления" className="grid gap-1 px-3">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/admin" }}
              activeProps={{ className: "border-primary/30 bg-primary/10 text-primary" }}
              className="flex min-h-11 items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-sidebar-border p-4">
          <Button asChild variant="default">
            <Link to="/cashier"><ShoppingCart className="size-4" />Открыть кассу<ArrowUpRight className="ml-auto size-4" /></Link>
          </Button>
          <Button variant="ghost" className="justify-start" onClick={signOut}>
            <LogOut className="size-4" />Выйти из аккаунта
          </Button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button size="icon" variant="secondary" className="lg:hidden" aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</Button>
            <div><p className="text-xs text-muted-foreground">Гриль &amp; Донер</p><p className="mt-1 text-sm font-semibold">{current.label}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="size-2 rounded-full bg-accent" />Администратор</span>
            <Button asChild variant="secondary" size="sm" className="lg:hidden"><Link to="/cashier"><ShoppingCart />Касса</Link></Button>
            <Button size="icon" variant="ghost" className="lg:hidden" title="Выйти из аккаунта" aria-label="Выйти из аккаунта" onClick={signOut}><LogOut /></Button>
          </div>
          {menuOpen && <nav aria-label="Разделы управления" className="grid w-full grid-cols-2 gap-2 border-t border-border pt-3 lg:hidden">{NAV.map((item) => <Button key={item.to} asChild variant={current.to === item.to ? "default" : "secondary"} className="h-auto min-h-11 justify-start whitespace-normal"><Link to={item.to} onClick={() => setMenuOpen(false)}><item.icon />{item.label}</Link></Button>)}</nav>}
        </header>
        <main className="admin-workspace mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
