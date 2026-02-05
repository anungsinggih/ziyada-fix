-- ============================================================
-- 0024_rbac_finance_owner_only.sql
-- Align RLS with RBAC: Admin can access all except finance
-- Finance (accounts/AR/AP/receipts/payments/journals/periods) -> OWNER only
-- Purchases -> Admin + Owner
-- ============================================================

-- Accounts (COA) -> OWNER only
drop policy if exists "accounts_read_all" on public.accounts;
create policy "accounts_read_all" on public.accounts
for select to authenticated
using (public.is_owner());

-- AR -> OWNER only
drop policy if exists "ar_select" on public.ar_invoices;
create policy "ar_select" on public.ar_invoices
for select to authenticated
using (public.is_owner());

drop policy if exists "ar_manage_owner" on public.ar_invoices;
create policy "ar_manage_owner" on public.ar_invoices
for all to authenticated
using (public.is_owner());

-- AP -> OWNER only
drop policy if exists "ap_select" on public.ap_bills;
create policy "ap_select" on public.ap_bills
for select to authenticated
using (public.is_owner());

drop policy if exists "ap_manage_owner" on public.ap_bills;
create policy "ap_manage_owner" on public.ap_bills
for all to authenticated
using (public.is_owner());

-- Receipts -> OWNER only
drop policy if exists "receipts_select" on public.receipts;
create policy "receipts_select" on public.receipts
for select to authenticated
using (public.is_owner());

drop policy if exists "receipts_insert" on public.receipts;
create policy "receipts_insert" on public.receipts
for insert to authenticated
with check (public.is_owner());

drop policy if exists "receipts_owner_mod" on public.receipts;
create policy "receipts_owner_mod" on public.receipts
for all to authenticated
using (public.is_owner());

-- Payments -> OWNER only
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
for select to authenticated
using (public.is_owner());

drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments
for insert to authenticated
with check (public.is_owner());

drop policy if exists "payments_owner_mod" on public.payments;
create policy "payments_owner_mod" on public.payments
for all to authenticated
using (public.is_owner());

-- Journals & periods already OWNER only in 0003, keep as-is
-- Opening balances already OWNER only

-- Purchases -> Admin + Owner
drop policy if exists "purchases_owner" on public.purchases;
create policy "purchases_owner" on public.purchases
for all to authenticated
using (public.is_admin() or public.is_owner());

drop policy if exists "purchase_items_owner" on public.purchase_items;
create policy "purchase_items_owner" on public.purchase_items
for all to authenticated
using (public.is_admin() or public.is_owner());

drop policy if exists "purchase_returns_owner" on public.purchase_returns;
create policy "purchase_returns_owner" on public.purchase_returns
for all to authenticated
using (public.is_admin() or public.is_owner());

drop policy if exists "purchase_return_items_owner" on public.purchase_return_items;
create policy "purchase_return_items_owner" on public.purchase_return_items
for all to authenticated
using (public.is_admin() or public.is_owner());
