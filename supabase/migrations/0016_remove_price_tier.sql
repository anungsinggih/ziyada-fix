-- Remove legacy price_tier fields (pricing now per-customer)

alter table if exists public.customers
  drop column if exists price_tier;

alter table if exists public.sales_items
  drop column if exists price_tier_applied;

drop type if exists public.price_tier;
