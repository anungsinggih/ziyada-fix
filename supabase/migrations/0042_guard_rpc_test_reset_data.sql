-- ============================================================
-- 0042_guard_rpc_test_reset_data.sql
-- Block rpc_test_reset_data in production
-- ============================================================

create or replace function public.rpc_test_reset_data()
returns void language plpgsql security definer as $$
declare
  v_env text := lower(coalesce(current_setting('app.environment', true), ''));
begin
  if v_env in ('production', 'prod') then
    raise exception 'PRODUCTION_BLOCKED: Cannot reset data in production environment.';
  end if;
  if not public.is_owner() then raise exception 'Owner only'; end if;
  
  -- Clear Trans
  delete from public.journal_lines;
  delete from public.journals;
  delete from public.receipts;
  delete from public.payments;
  
  delete from public.sales_return_items;
  delete from public.sales_returns;
  delete from public.purchase_return_items;
  delete from public.purchase_returns;
  
  delete from public.sales_items;
  delete from public.ar_invoices;
  delete from public.sales;
  
  delete from public.purchase_items;
  delete from public.ap_bills;
  delete from public.purchases;
  
  -- Clear Inv
  delete from public.inventory_adjustments;
  update public.inventory_stock set qty_on_hand = 0, avg_cost = 0;
  
  -- Clear Period Logs
  delete from public.period_exports;
  
  -- Reset Sequences
  update public.tx_doc_sequences set last_seq = 0;

  -- Clear OB
  delete from public.opening_balances;
end $$;
