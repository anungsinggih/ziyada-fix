-- ============================================================
-- 0060_normalize_items_sku.sql
-- Normalize SKU to uppercase on insert/update
-- ============================================================

create or replace function public.normalize_item_sku()
returns trigger language plpgsql as $$
begin
  if NEW.sku is not null then
    NEW.sku := upper(btrim(NEW.sku));
  end if;
  return NEW;
end $$;

drop trigger if exists trg_items_normalize_sku on public.items;
create trigger trg_items_normalize_sku
before insert or update on public.items
for each row execute function public.normalize_item_sku();
