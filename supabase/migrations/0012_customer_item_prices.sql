-- Per-customer custom sales price
create table if not exists public.customer_item_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  price numeric(14,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_customer_item_price_nonneg check (price >= 0),
  constraint uq_customer_item_price unique (customer_id, item_id)
);

create index if not exists idx_customer_item_prices_customer on public.customer_item_prices(customer_id);
create index if not exists idx_customer_item_prices_item on public.customer_item_prices(item_id);

drop trigger if exists trg_customer_item_prices_updated_at on public.customer_item_prices;
create trigger trg_customer_item_prices_updated_at
before update on public.customer_item_prices
for each row execute function set_updated_at();

-- Note: legacy backfill removed (price_tier deprecated)
