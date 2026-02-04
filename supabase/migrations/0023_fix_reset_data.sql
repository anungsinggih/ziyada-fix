-- ============================================================
-- 0023_fix_reset_data.sql
-- Fix rpc_reset_testing_data to include payment_methods and use is_system_account
-- ============================================================

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
    
    -- In TRANSACTIONS_ONLY we keep custom payment methods if they exist, 
    -- OR we can choose to reset them. 
    -- The original logic reset them to default CASH/BANK. Let's stick to that to be safe.
    -- But we must ensure referenced accounts still exist (they should, as we don't delete accounts in this mode).
    delete from public.payment_methods where true;
    
    -- Re-seed default payment methods (CASH and BANK)
    -- Note: 1100, 1110, 1111 should exist as system accounts
    insert into public.payment_methods (code, name, account_id)
    select 'CASH', 'Kas Tunai', id from public.accounts where code = '1100'
    union all
    select 'BANK', 'Bank Utama', id from public.accounts where code = '1110'
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

    -- Also delete payment methods before accounts
    delete from public.payment_methods where true;
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;

    -- Delete tables that might be missed
    delete from public.customer_item_prices where true;
    delete from public.company_banks where true; -- Reset banks in FULL mode? Or keep? Reset implies clean slate.

    -- Delete non-system accounts
    -- Using is_system_account flag is safer than hardcoding codes
    delete from public.accounts
    where is_system_account = false 
      and code not in ('1100', '1200', '1300', '2100', '4100', '5100', '1110', '1111', '4120', '5200'); 
      -- We add the critical codes just in case is_system_account wasn't set correctly on some old data, 
      -- but newer standard is is_system_account.
      
    get diagnostics v_temp_count = row_count;
    v_affected_count := v_affected_count + v_temp_count;
    
    -- Re-seed default payment methods
    insert into public.payment_methods (code, name, account_id)
    select 'CASH', 'Kas Tunai', id from public.accounts where code = '1100'
    union all
    select 'BANK', 'Bank Utama', id from public.accounts where code = '1110'
    on conflict (code) do update
    set name = excluded.name,
        account_id = excluded.account_id,
        is_active = true;
    
    alter table public.sales enable trigger trg_immutable_sales;
    alter table public.purchases enable trigger trg_immutable_purchases;
    alter table public.sales_returns enable trigger trg_immutable_sales_returns;
    alter table public.purchase_returns enable trigger trg_lock_purchase_returns_period;
    
    raise notice 'FULL mode: % records deleted. System accounts preserved.', v_affected_count;

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
