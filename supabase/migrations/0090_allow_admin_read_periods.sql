-- Allow Admin to read accounting periods (for warning banner)
-- Previous policy "periods_owner" only allowed Owner to do everything.
-- We add a policy to allow Admin to SELECT. Policies are additive.

create policy "periods_select_admin" on public.accounting_periods 
  for select to authenticated 
  using (public.is_admin());
