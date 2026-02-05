-- ============================================================
-- 0044_tx_doc_sequences_rls.sql
-- Protect document sequence table (Admin/Owner only)
-- ============================================================

alter table public.tx_doc_sequences enable row level security;

drop policy if exists "tx_doc_sequences_rw" on public.tx_doc_sequences;
create policy "tx_doc_sequences_rw" on public.tx_doc_sequences
for all to authenticated
using (public.is_admin() or public.is_owner())
with check (public.is_admin() or public.is_owner());
