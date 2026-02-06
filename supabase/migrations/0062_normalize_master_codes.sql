-- ============================================================
-- 0062_normalize_master_codes.sql
-- Normalize master codes (trim + uppercase)
-- ============================================================

create or replace function public.normalize_code_upper()
returns trigger language plpgsql as $$
begin
  if NEW.code is not null then
    NEW.code := upper(btrim(NEW.code));
  end if;
  return NEW;
end $$;

drop trigger if exists trg_uoms_normalize_code on public.uoms;
create trigger trg_uoms_normalize_code
before insert or update on public.uoms
for each row execute function public.normalize_code_upper();

drop trigger if exists trg_sizes_normalize_code on public.sizes;
create trigger trg_sizes_normalize_code
before insert or update on public.sizes
for each row execute function public.normalize_code_upper();

drop trigger if exists trg_colors_normalize_code on public.colors;
create trigger trg_colors_normalize_code
before insert or update on public.colors
for each row execute function public.normalize_code_upper();
