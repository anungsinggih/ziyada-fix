-- ============================================================
-- 0041_reset_audit_log_rls.sql
-- Ensure reset_audit_log RLS policies exist (Owner only)
-- ============================================================

alter table public.reset_audit_log enable row level security;

drop policy if exists "Owner can view reset audit log" on public.reset_audit_log;
create policy "Owner can view reset audit log"
  on public.reset_audit_log
  for select
  using (public.is_owner());

drop policy if exists "Owner can insert reset audit log" on public.reset_audit_log;
create policy "Owner can insert reset audit log"
  on public.reset_audit_log
  for insert
  with check (public.is_owner());
