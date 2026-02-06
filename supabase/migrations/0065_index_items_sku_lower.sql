-- ============================================================
-- 0065_index_items_sku_lower.sql
-- Speed up case-insensitive SKU lookup (import, search)
-- ============================================================

create index if not exists idx_items_sku_lower on public.items (lower(sku));
