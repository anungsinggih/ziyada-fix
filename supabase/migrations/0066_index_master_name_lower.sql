-- ============================================================
-- 0066_index_master_name_lower.sql
-- Speed up case-insensitive master name lookup
-- ============================================================

create index if not exists idx_brands_name_lower on public.brands (lower(name));
create index if not exists idx_categories_name_lower on public.categories (lower(name));
create index if not exists idx_uoms_name_lower on public.uoms (lower(name));
create index if not exists idx_sizes_name_lower on public.sizes (lower(name));
create index if not exists idx_colors_name_lower on public.colors (lower(name));
