-- ============================================================
-- 0039_customer_item_prices_rls.sql
-- Enable RLS for customer_item_prices (Admin/Owner RW)
-- ============================================================

alter table public.customer_item_prices enable row level security;

drop policy if exists "customer_item_prices_rw" on public.customer_item_prices;
create policy "customer_item_prices_rw" on public.customer_item_prices
for all to authenticated
using (public.is_admin() or public.is_owner())
with check (public.is_admin() or public.is_owner());
