-- ============================================================
-- 0061_normalize_master_names.sql
-- Normalize master names (trim) on insert/update
-- ============================================================

create or replace function public.normalize_name_trim()
returns trigger language plpgsql as $$
begin
  if NEW.name is not null then
    NEW.name := btrim(NEW.name);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_brands_normalize_name on public.brands;
create trigger trg_brands_normalize_name
before insert or update on public.brands
for each row execute function public.normalize_name_trim();

drop trigger if exists trg_categories_normalize_name on public.categories;
create trigger trg_categories_normalize_name
before insert or update on public.categories
for each row execute function public.normalize_name_trim();

drop trigger if exists trg_uoms_normalize_name on public.uoms;
create trigger trg_uoms_normalize_name
before insert or update on public.uoms
for each row execute function public.normalize_name_trim();

drop trigger if exists trg_sizes_normalize_name on public.sizes;
create trigger trg_sizes_normalize_name
before insert or update on public.sizes
for each row execute function public.normalize_name_trim();

drop trigger if exists trg_colors_normalize_name on public.colors;
create trigger trg_colors_normalize_name
before insert or update on public.colors
for each row execute function public.normalize_name_trim();
