-- ============================================================
-- 0074_add_line_item_checks.sql
-- Guard line item qty/price are non-negative and qty > 0
-- ============================================================

-- Sales items
alter table public.sales_items
drop constraint if exists ck_sales_items_qty_positive;
alter table public.sales_items
add constraint ck_sales_items_qty_positive check (qty > 0);

alter table public.sales_items
drop constraint if exists ck_sales_items_unit_price_nonneg;
alter table public.sales_items
add constraint ck_sales_items_unit_price_nonneg check (unit_price >= 0);

-- Purchase items
alter table public.purchase_items
drop constraint if exists ck_purchase_items_qty_positive;
alter table public.purchase_items
add constraint ck_purchase_items_qty_positive check (qty > 0);

alter table public.purchase_items
drop constraint if exists ck_purchase_items_unit_cost_nonneg;
alter table public.purchase_items
add constraint ck_purchase_items_unit_cost_nonneg check (unit_cost >= 0);

-- Sales return items
alter table public.sales_return_items
drop constraint if exists ck_sales_return_items_qty_positive;
alter table public.sales_return_items
add constraint ck_sales_return_items_qty_positive check (qty > 0);

alter table public.sales_return_items
drop constraint if exists ck_sales_return_items_unit_price_nonneg;
alter table public.sales_return_items
add constraint ck_sales_return_items_unit_price_nonneg check (unit_price >= 0);

-- Purchase return items
alter table public.purchase_return_items
drop constraint if exists ck_purchase_return_items_qty_positive;
alter table public.purchase_return_items
add constraint ck_purchase_return_items_qty_positive check (qty > 0);

alter table public.purchase_return_items
drop constraint if exists ck_purchase_return_items_unit_cost_nonneg;
alter table public.purchase_return_items
add constraint ck_purchase_return_items_unit_cost_nonneg check (unit_cost >= 0);
