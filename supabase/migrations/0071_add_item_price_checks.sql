-- ============================================================
-- 0071_add_item_price_checks.sql
-- Add non-negative checks for item pricing fields
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ck_items_price_nonneg'
  ) then
    alter table public.items
      add constraint ck_items_price_nonneg
      check (
        coalesce(price_default, 0) >= 0 and
        coalesce(price_khusus, 0) >= 0 and
        coalesce(default_price_buy, 0) >= 0 and
        coalesce(min_stock, 0) >= 0
      );
  end if;
end $$;
