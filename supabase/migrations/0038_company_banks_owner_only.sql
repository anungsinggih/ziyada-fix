-- ============================================================
-- 0038_company_banks_owner_only.sql
-- Restrict company bank management to OWNER; allow read for all authenticated
-- ============================================================

drop policy if exists "company_banks_rw" on public.company_banks;

create policy "company_banks_read" on public.company_banks
for select to authenticated
using (true);

create policy "company_banks_manage_owner" on public.company_banks
for all to authenticated
using (public.is_owner())
with check (public.is_owner());
