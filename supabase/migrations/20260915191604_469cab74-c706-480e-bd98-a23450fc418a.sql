-- ORDERS: statuses, daily number, customer info
alter table public.orders
  add column if not exists daily_no integer,
  add column if not exists order_type text not null default 'takeaway',
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_id uuid,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_by uuid,
  add column if not exists bonus_earned integer not null default 0,
  add column if not exists bonus_used integer not null default 0;

update public.orders set status = 'completed' where status in ('paid', 'closed');

alter table public.orders
  alter column status set default 'open';

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- daily order number, resets every day
create or replace function public.set_order_daily_no() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.daily_no is null then
    select coalesce(max(daily_no), 0) + 1 into new.daily_no
    from public.orders
    where created_at >= date_trunc('day', now());
  end if;
  return new;
end; $$;

drop trigger if exists orders_daily_no on public.orders;
create trigger orders_daily_no before insert on public.orders
for each row execute function public.set_order_daily_no();

-- SHIFTS: single open shift, cash control, 24h limit
alter table public.shifts
  add column if not exists expected_cash integer,
  add column if not exists cash_diff integer,
  add column if not exists sales_total integer not null default 0,
  add column if not exists orders_count integer not null default 0,
  add column if not exists auto_closed boolean not null default false;

create unique index if not exists shifts_single_open on public.shifts ((status)) where status = 'open';

create or replace function public.close_expired_shifts() returns integer
language plpgsql security definer set search_path = public as $$
declare
  affected integer;
begin
  update public.shifts
     set status = 'closed',
         closed_at = opened_at + interval '24 hours',
         auto_closed = true,
         note = coalesce(note, '') || ' [автозакрытие: превышены 24 часа]'
   where status = 'open'
     and opened_at < now() - interval '24 hours';
  get diagnostics affected = row_count;
  return affected;
end; $$;

revoke execute on function public.close_expired_shifts() from public, anon;
grant execute on function public.close_expired_shifts() to authenticated, service_role;

-- EMPLOYEES: pin lockout and details
alter table public.employees
  add column if not exists pin_attempts integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists phone text,
  add column if not exists hired_at date;

-- CUSTOMERS and loyalty
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  phone text not null unique,
  bonus integer not null default 0,
  visits integer not null default 0,
  total_spent integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "staff manage customers" on public.customers for all to authenticated using (true) with check (true);
create trigger customers_updated before update on public.customers for each row execute function public.set_updated_at();

-- CASH operations (deposits / withdrawals)
create table if not exists public.cash_operations (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  type text not null default 'in',
  amount integer not null,
  reason text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.cash_operations to authenticated;
grant all on public.cash_operations to service_role;
alter table public.cash_operations enable row level security;
create policy "staff manage cash ops" on public.cash_operations for all to authenticated using (true) with check (true);

-- AUDIT log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "staff read audit" on public.audit_log for select to authenticated using (true);
create policy "staff write audit" on public.audit_log for insert to authenticated with check (true);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- DISCOUNT presets
create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'percent',
  value integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.discounts to authenticated;
grant all on public.discounts to service_role;
alter table public.discounts enable row level security;
create policy "staff manage discounts" on public.discounts for all to authenticated using (true) with check (true);

insert into public.discounts (name, kind, value) values
  ('Скидка 5%', 'percent', 5),
  ('Скидка 10%', 'percent', 10),
  ('Скидка 500 ₸', 'amount', 500)
on conflict do nothing;

-- SETTINGS extras
alter table public.settings
  add column if not exists low_stock_threshold numeric not null default 5,
  add column if not exists bonus_percent numeric not null default 0,
  add column if not exists order_prefix text not null default '',
  add column if not exists print_customer_receipt boolean not null default true,
  add column if not exists print_cashier_receipt boolean not null default true,
  add column if not exists shift_max_hours integer not null default 24;

-- realtime for order board
alter publication supabase_realtime add table public.orders;