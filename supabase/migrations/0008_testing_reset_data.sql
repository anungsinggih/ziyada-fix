-- ============================================================
-- 0008_testing_reset_data.sql
-- DEV/UAT ONLY: Reset Testing Data
-- This file runs only in non-production environments
-- ============================================================

set search_path = public;

-- Reset Audit Log
create table if not exists public.reset_audit_log (
  id uuid primary key default gen_random_uuid(),
  reset_by uuid not null references auth.users(id),
  reset_mode text not null,
  environment_check text,
  reset_at timestamptz not null default now(),
  notes text
);

comment on table public.reset_audit_log is 
'DEV/UAT ONLY: Audit log for data reset operations';

create or replace function public.rpc_reset_testing_data(
  p_confirmation_text text,
  p_reset_mode text default 'TRANSACTIONS_ONLY',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role app_role;
  v_affected_count int := 0;
  v_temp_count int;
begin
  if p_confirmation_text != 'RESET' then
    raise exception 'CONFIRMATION_FAILED: You must type "RESET" exactly to proceed.' using hint = 'Prevent accidental data loss.';
  end if;

  select role into v_caller_role
  from public.user_profiles
  where id = auth.uid();
  
  if v_caller_role != 'OWNER' then
    raise exception 'PERMISSION_DENIED: Only OWNER can reset testing data.' using hint = 'Restricted to system administrators.';
  end if;

  if p_reset_mode = 'TRANSACTIONS_ONLY' then
    alter table public.sales disable trigger trg_immutable_sales;
    alter table public.purchases disable trigger trg_immutable_purchases;
    alter table public.sales_returns disable trigger trg_immutable_sales_returns;
    alter table public.purchase_returns disable trigger trg_lock_purchase_returns_period;

    delete from public.sales_returns where true;
    delete from public.purchase_return_items where true;
    delete from public.purchase_returns where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;

    delete from public.sales where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.purchases where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.receipts where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.payments where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.ar_invoices where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.ap_bills where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.journals where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.inventory_adjustments where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    update public.inventory_stock set qty_on_hand = 0, avg_cost = 0 where true;
    
    delete from public.period_exports where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.accounting_periods where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.opening_balances where true;
    delete from public.payment_methods where true;
    insert into public.payment_methods (code, name, account_id)
    values
      ('CASH', 'Kas Tunai', (select id from public.accounts where code = '1100')),
      ('BANK', 'Bank Utama', (select id from public.accounts where code = '1110'))
    on conflict (code) do update
    set name = excluded.name,
        account_id = excluded.account_id,
        is_active = true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;

    alter table public.sales enable trigger trg_immutable_sales;
    alter table public.purchases enable trigger trg_immutable_purchases;
    alter table public.sales_returns enable trigger trg_immutable_sales_returns;
    alter table public.purchase_returns enable trigger trg_lock_purchase_returns_period;

    raise notice 'TRANSACTIONS_ONLY mode: % records deleted', v_affected_count;

  elsif p_reset_mode = 'FULL' then
    alter table public.sales disable trigger trg_immutable_sales;
    alter table public.purchases disable trigger trg_immutable_purchases;
    alter table public.sales_returns disable trigger trg_immutable_sales_returns;
    alter table public.purchase_returns disable trigger trg_lock_purchase_returns_period;
    
    delete from public.sales_returns where true;
    delete from public.purchase_return_items where true;
    delete from public.purchase_returns where true;
    delete from public.sales where true;
    delete from public.purchases where true;
    delete from public.receipts where true;
    delete from public.payments where true;
    delete from public.ar_invoices where true;
    delete from public.ap_bills where true;
    delete from public.journals where true;
    delete from public.inventory_adjustments where true;
    delete from public.period_exports where true;
    delete from public.accounting_periods where true;
    delete from public.opening_balances where true;
    
    delete from public.inventory_stock where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.items where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.customers where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.vendors where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    delete from public.accounts
    where code not in ('1100', '1200', '1300', '2100', '4100', '5100');
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    alter table public.sales enable trigger trg_immutable_sales;
    alter table public.purchases enable trigger trg_immutable_purchases;
    alter table public.sales_returns enable trigger trg_immutable_sales_returns;
    alter table public.purchase_returns enable trigger trg_lock_purchase_returns_period;
    
    raise notice 'FULL mode: % records deleted (COA seed preserved)', v_affected_count;

  else
    raise exception 'INVALID_MODE: p_reset_mode must be "TRANSACTIONS_ONLY" or "FULL"';
  end if;

  insert into public.reset_audit_log (reset_by, reset_mode, environment_check, notes)
  values (
    auth.uid(),
    p_reset_mode,
    current_setting('app.environment', true),
    p_notes
  );

  return jsonb_build_object(
    'success', true,
    'mode', p_reset_mode,
    'affected_records', v_affected_count,
    'reset_at', now(),
    'reset_by', auth.uid(),
    'message', 'Testing data reset completed successfully'
  );
  
exception
  when others then
    raise exception 'RESET_FAILED: %', sqlerrm;
end;
$$;

comment on function public.rpc_reset_testing_data(text, text, text) is 
'DEV/UAT ONLY: Reset testing data. OWNER only. Requires "RESET" confirmation. 
Modes: TRANSACTIONS_ONLY (default, preserves master data) or FULL (resets everything except COA seed).
WARNING: This is irreversible in the current database instance.';

comment on column reset_audit_log.reset_mode is 
'TRANSACTIONS_ONLY = Delete transactions only, preserve master data. FULL = Delete all data except COA seed.';

alter table public.reset_audit_log enable row level security;

drop policy if exists "Owner can view reset audit log" on public.reset_audit_log;

create policy "Owner can view reset audit log"
  on public.reset_audit_log
  for select
  using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'OWNER'
    )
  );
