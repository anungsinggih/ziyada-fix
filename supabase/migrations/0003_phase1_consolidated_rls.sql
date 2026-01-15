-- ============================================================
-- 0003_phase1_consolidated_rls.sql
-- PHASE 1 RLS POLICIES (Consolidated)
-- Merges: 0003, 015 (whitelist policy), 024 (company profile policy), 028 (master data v2), 029 (storage)
-- ============================================================

set search_path = public;

-- 0) Helper functions
create or replace function public.current_app_role()
returns app_role language sql stable security definer as $$
  select up.role from public.user_profiles up where up.id = auth.uid()
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer as $$
  select public.current_app_role() = 'OWNER'
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select public.current_app_role() = 'ADMIN'
$$;

-- 1) Enable RLS on ALL Tables
-- (Some enabled in 0001, but we enforce here for safety)
alter table public.user_profiles enable row level security;
alter table public.signup_whitelist enable row level security;
alter table public.company_profile enable row level security;

alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.items enable row level security;
alter table public.uoms enable row level security;
alter table public.sizes enable row level security;
alter table public.colors enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.product_parents enable row level security;

alter table public.inventory_stock enable row level security;
alter table public.inventory_adjustments enable row level security;

alter table public.accounts enable row level security;
alter table public.opening_balances enable row level security;
alter table public.payment_methods enable row level security;
alter table public.journals enable row level security;
alter table public.journal_lines enable row level security;

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.ap_bills enable row level security;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

alter table public.sales enable row level security;
alter table public.sales_items enable row level security;
alter table public.sales_returns enable row level security;
alter table public.sales_return_items enable row level security;
alter table public.ar_invoices enable row level security;

alter table public.receipts enable row level security;
alter table public.payments enable row level security;

alter table public.accounting_periods enable row level security;
alter table public.period_exports enable row level security;

-- ============================================================
-- 2) SYSTEM POLICIES (Users, Whitelist, Company)
-- ============================================================

-- Whitelist: Owner only
drop policy if exists "whitelist_owner_manage" on public.signup_whitelist;
create policy "whitelist_owner_manage" on public.signup_whitelist for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- User Profiles: Owner read all, Admin read self, Self read/update self
drop policy if exists "profiles_select_owner" on public.user_profiles;
create policy "profiles_select_owner" on public.user_profiles for select to authenticated using (public.is_owner());

drop policy if exists "profiles_select_self" on public.user_profiles;
create policy "profiles_select_self" on public.user_profiles for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.user_profiles;
create policy "profiles_update_self" on public.user_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Company Profile: Read All, Owner Update
drop policy if exists "company_read_all" on public.company_profile;
create policy "company_read_all" on public.company_profile for select to authenticated using (true);

drop policy if exists "company_update_owner" on public.company_profile;
create policy "company_update_owner" on public.company_profile for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- ============================================================
-- 3) MASTER DATA POLICIES (Admin & Owner RW)
-- ============================================================
-- Consolidating repetitive policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'vendors', 'items', 'uoms', 'sizes', 'colors', 'brands', 'categories', 'product_parents'
  ] loop
    execute format('drop policy if exists "master_%s_rw" on public.%I', t, t);
    execute format('create policy "master_%s_rw" on public.%I for all to authenticated using (public.is_admin() or public.is_owner()) with check (public.is_admin() or public.is_owner())', t, t);
  end loop;
end $$;

-- Payment Methods: Owner manage, Everyone read (needed for UI/logic)
drop policy if exists "paymethod_read_all" on public.payment_methods;
create policy "paymethod_read_all" on public.payment_methods for select to authenticated using (true);

drop policy if exists "paymethod_manage_owner" on public.payment_methods;
create policy "paymethod_manage_owner" on public.payment_methods for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Accounts: Read All (needed for dropdowns), Owner Manage
drop policy if exists "accounts_read_all" on public.accounts;
create policy "accounts_read_all" on public.accounts for select to authenticated using (true);

drop policy if exists "accounts_manage_owner" on public.accounts;
create policy "accounts_manage_owner" on public.accounts for all to authenticated using (public.is_owner()) with check (public.is_owner());


-- ============================================================
-- 4) INVENTORY (Admin & Owner RW)
-- ============================================================
drop policy if exists "stock_rw" on public.inventory_stock;
create policy "stock_rw" on public.inventory_stock for all to authenticated using (public.is_admin() or public.is_owner());

drop policy if exists "adj_rw" on public.inventory_adjustments;
create policy "adj_rw" on public.inventory_adjustments for all to authenticated using (public.is_admin() or public.is_owner());

-- ============================================================
-- 5) SALES & AR (Admin & Owner)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'sales', 'sales_items', 'sales_returns', 'sales_return_items'
  ] loop
    execute format('drop policy if exists "%s_rw" on public.%I', t, t);
    execute format('create policy "%s_rw" on public.%I for all to authenticated using (public.is_admin() or public.is_owner())', t, t);
  end loop;
end $$;

-- AR: Admin select, Owner all
drop policy if exists "ar_select" on public.ar_invoices;
create policy "ar_select" on public.ar_invoices for select to authenticated using (public.is_admin() or public.is_owner());

drop policy if exists "ar_manage_owner" on public.ar_invoices;
create policy "ar_manage_owner" on public.ar_invoices for all to authenticated using (public.is_owner());


-- ============================================================
-- 6) PURCHASE & AP (Owner Only, Admin Select)
-- ============================================================
-- Purchase: Owner Only (Scope Locked in Phase 1)
drop policy if exists "purchases_owner" on public.purchases;
create policy "purchases_owner" on public.purchases for all to authenticated using (public.is_owner());

drop policy if exists "purchase_items_owner" on public.purchase_items;
create policy "purchase_items_owner" on public.purchase_items for all to authenticated using (public.is_owner());

drop policy if exists "purchase_returns_owner" on public.purchase_returns;
create policy "purchase_returns_owner" on public.purchase_returns for all to authenticated using (public.is_owner());

drop policy if exists "purchase_return_items_owner" on public.purchase_return_items;
create policy "purchase_return_items_owner" on public.purchase_return_items for all to authenticated using (public.is_owner());


-- AP: Admin Select, Owner All
drop policy if exists "ap_select" on public.ap_bills;
create policy "ap_select" on public.ap_bills for select to authenticated using (public.is_admin() or public.is_owner());

drop policy if exists "ap_manage_owner" on public.ap_bills;
create policy "ap_manage_owner" on public.ap_bills for all to authenticated using (public.is_owner());


-- ============================================================
-- 7) RECEIPTS & PAYMENTS
-- ============================================================
-- Receipts: Admin/Owner Create, Owner Delete
drop policy if exists "receipts_select" on public.receipts;
create policy "receipts_select" on public.receipts for select to authenticated using (public.is_admin() or public.is_owner());

drop policy if exists "receipts_insert" on public.receipts;
create policy "receipts_insert" on public.receipts for insert to authenticated with check (public.is_admin() or public.is_owner());

drop policy if exists "receipts_owner_mod" on public.receipts;
create policy "receipts_owner_mod" on public.receipts for all to authenticated using (public.is_owner());
-- Overlaps? 'for all' covers insert/update/delete.
-- Ideally:
-- Select: Admin, Owner
-- Insert: Admin, Owner
-- Update/Delete: Owner
-- Postgres policy merging is additive (OR).
-- If I say 'receipts_select_admin' (Select) and 'receipts_owner_all' (All), Owner can do all, Admin can Select.
-- But Admin needs Insert.
-- So:
-- 1. All (Owner)
-- 2. Select (Admin)
-- 3. Insert (Admin)
-- Let's stick to explicit:

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments for select to authenticated using (public.is_admin() or public.is_owner());

drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments for insert to authenticated with check (public.is_admin() or public.is_owner());

drop policy if exists "payments_owner_mod" on public.payments;
create policy "payments_owner_mod" on public.payments for all to authenticated using (public.is_owner());


-- ============================================================
-- 8) FINANCE (Owner Only)
-- ============================================================
drop policy if exists "opening_owner" on public.opening_balances;
create policy "opening_owner" on public.opening_balances for all to authenticated using (public.is_owner());

drop policy if exists "journals_owner" on public.journals;
create policy "journals_owner" on public.journals for all to authenticated using (public.is_owner());

drop policy if exists "lines_owner" on public.journal_lines;
create policy "lines_owner" on public.journal_lines for all to authenticated using (public.is_owner());

drop policy if exists "periods_owner" on public.accounting_periods;
create policy "periods_owner" on public.accounting_periods for all to authenticated using (public.is_owner());

drop policy if exists "exports_owner" on public.period_exports;
create policy "exports_owner" on public.period_exports for all to authenticated using (public.is_owner());


-- ============================================================
-- 9) STORAGE
-- ============================================================
-- Included in 0003 for consolidation, from 029
-- Need 'storage' extension enabled? Usually pre-installed.
-- Policies on storage.objects

drop policy if exists "Images Public Read" on storage.objects;
create policy "Images Public Read"
on storage.objects for select
using ( bucket_id = 'images' );

drop policy if exists "Images Auth Insert" on storage.objects;
create policy "Images Auth Insert"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'images' );

drop policy if exists "Images Owner Delete" on storage.objects;
create policy "Images Owner Delete"
on storage.objects for delete
to authenticated
using ( bucket_id = 'images' and (auth.uid() = owner) );
-- Note: 'owner' column in storage.objects refers to uploader, usually.
-- Or should Admin/Owner app_role be able to delete?
-- 029 said: (bucket_id = 'images' AND ((auth.uid() = owner) OR is_admin() OR is_owner()))
-- Let's stick to 029 logic if possible, or simple "uploader deletes" for now.
-- Updating to match 029 intent (Admin/Owner delete):

drop policy if exists "Images App Admin Delete" on storage.objects;
create policy "Images App Admin Delete"
on storage.objects for delete
to authenticated
using ( bucket_id = 'images' and (public.is_admin() or public.is_owner()) );
