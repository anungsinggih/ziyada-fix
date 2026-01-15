-- ============================================================
-- 0004_phase1_consolidated_rpc_posting.sql
-- PHASE 1 RPC POSTING ENGINE (Consolidated)
-- Merges: 0004, 008, 009, 010, 011, 020, 022, 026
-- Includes: Helpers, Post Sales/Purchase, Returns, Receipts, Inventory Adj
-- ============================================================

set search_path = public;

-- ============================================================
-- 1. HELPERS
-- ============================================================

-- Ensure Stock Row
create or replace function public.ensure_stock_row(p_item_id uuid)
returns void language plpgsql as $$
begin
  insert into public.inventory_stock(item_id, qty_on_hand) values (p_item_id, 0)
  on conflict (item_id) do nothing;
end $$;

-- Apply Stock Delta (Check constraint prevents neg stock if not allowed, but here we enforce check in table)
create or replace function public.apply_stock_delta(p_item_id uuid, p_delta numeric)
returns void language plpgsql as $$
begin
  perform public.ensure_stock_row(p_item_id);
  update public.inventory_stock set qty_on_hand = qty_on_hand + p_delta where item_id = p_item_id;
end $$;

-- Create Journal Header
create or replace function public.create_journal(p_date date, p_ref_type text, p_ref_id uuid, p_memo text)
returns uuid language plpgsql as $$
declare v_journal_id uuid;
begin
  insert into public.journals(journal_date, ref_type, ref_id, memo)
  values (p_date, p_ref_type, p_ref_id, p_memo)
  returning id into v_journal_id;
  return v_journal_id;
end $$;

-- Add Journal Line
create or replace function public.add_journal_line(p_journal_id uuid, p_account_id uuid, p_debit numeric, p_credit numeric, p_memo text)
returns void language plpgsql as $$
begin
  insert into public.journal_lines(journal_id, account_id, debit, credit, line_memo)
  values (p_journal_id, p_account_id, coalesce(p_debit,0), coalesce(p_credit,0), p_memo);
end $$;

-- Get Payment Account
create or replace function public.get_payment_account_for_method(p_method text)
returns uuid language plpgsql as $$
declare
  v_code text := upper(coalesce(trim(p_method), 'CASH'));
  v_account uuid;
begin
  select account_id into v_account from public.payment_methods where code = v_code and is_active limit 1;
  if v_account is null then raise exception 'Payment method % is not configured', v_code; end if;
  return v_account;
end $$;

-- ============================================================
-- 2. LOCK TRIGGERS (Business Logic Enforced)
-- ============================================================

-- Lock Inventory Adjustments
create or replace function public.lock_inventory_adjustments_in_closed_period()
returns trigger language plpgsql as $$
declare d date;
begin
  d := coalesce(coalesce(NEW.adjusted_at, OLD.adjusted_at)::date, current_date);
  if public.is_date_in_closed_period(d) then
    raise exception 'Periode CLOSED: tidak boleh ubah Adjustment pada tanggal %', d;
  end if;
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists trg_lock_inventory_adjustments_period on public.inventory_adjustments;
create trigger trg_lock_inventory_adjustments_period before insert or update or delete on public.inventory_adjustments for each row execute function public.lock_inventory_adjustments_in_closed_period();


-- Lock Purchase Returns
create or replace function public.lock_purchase_returns_in_closed_period()
returns trigger language plpgsql as $$
declare d date;
begin
  d := coalesce(coalesce(NEW.return_date, OLD.return_date)::date, current_date);
  if public.is_date_in_closed_period(d) then
    if TG_OP = 'INSERT' then
      if NEW.status = 'POSTED' then raise exception 'Periode CLOSED: tidak boleh POSTED Return Pembelian pada tanggal %', d; end if;
    elsif TG_OP = 'UPDATE' then
      if OLD.status = 'POSTED' or NEW.status = 'POSTED' then raise exception 'Periode CLOSED: tidak boleh ubah Return Pembelian POSTED pada tanggal %', d; end if;
    end if;
  end if;
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists trg_lock_purchase_returns_period on public.purchase_returns;
create trigger trg_lock_purchase_returns_period before insert or update on public.purchase_returns for each row execute function public.lock_purchase_returns_in_closed_period();


-- ============================================================
-- 3. CORE POSTING ENGINE
-- ============================================================

-- RPC POST SALES (from 008)
create or replace function public.rpc_post_sales(p_sales_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_sales record;
  v_total numeric(14,2);
  v_total_cogs numeric(14,2);
  v_total_cogs_fg numeric(14,2);
  v_total_cogs_rm numeric(14,2);
  v_journal_id uuid;
  v_receipt_id uuid;
  v_ar_id uuid;
  v_line record;
  v_cash_acc_id uuid;
  v_ar_acc_id uuid;
  v_sales_acc_id uuid;
  v_inventory_acc_id uuid;
  v_rm_inventory_acc_id uuid;
  v_cogs_acc_id uuid;
begin
  select id into v_cash_acc_id from public.accounts where code = '1100';
  select id into v_ar_acc_id from public.accounts where code = '1200';
  select id into v_sales_acc_id from public.accounts where code = '4100';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inventory_acc_id from public.accounts where code = '1310';
  select id into v_cogs_acc_id from public.accounts where code = '5100';
  
  if v_cash_acc_id is null or v_ar_acc_id is null or v_sales_acc_id is null or v_inventory_acc_id is null or v_rm_inventory_acc_id is null or v_cogs_acc_id is null then
    raise exception 'COA Codes missing (1100, 1200, 4100, 1300, 1310, 5100)';
  end if;

  select * into v_sales from public.sales where id = p_sales_id for update;
  if not found then raise exception 'Sales not found'; end if;
  if v_sales.status <> 'DRAFT' then raise exception 'Sales must be DRAFT to post'; end if;
  if public.is_date_in_closed_period(v_sales.sales_date) then raise exception 'Periode CLOSED'; end if;

  select coalesce(sum(subtotal),0) into v_total from public.sales_items where sales_id = p_sales_id;
  if v_total <= 0 then raise exception 'Sales total must be > 0'; end if;

  -- COGS
  select
    coalesce(sum(si.qty * coalesce(inv.avg_cost, i.default_price_buy)), 0)::numeric(14,2),
    coalesce(sum(si.qty * coalesce(inv.avg_cost, i.default_price_buy)) filter (where i.type = 'FINISHED_GOOD'), 0)::numeric(14,2),
    coalesce(sum(si.qty * coalesce(inv.avg_cost, i.default_price_buy)) filter (where i.type = 'RAW_MATERIAL'), 0)::numeric(14,2)
  into v_total_cogs, v_total_cogs_fg, v_total_cogs_rm
  from public.sales_items si
  join public.items i on i.id = si.item_id
  left join public.inventory_stock inv on inv.item_id = i.id
  where si.sales_id = p_sales_id;

  -- Inventory decrease + snapshot
  for v_line in select si.id, si.item_id, si.qty, coalesce(inv.avg_cost, i.default_price_buy)::numeric(14,4) as cost_basis
                from public.sales_items si
                join public.items i on i.id = si.item_id
                left join public.inventory_stock inv on inv.item_id = i.id
                where si.sales_id = p_sales_id loop
    perform public.apply_stock_delta(v_line.item_id, -v_line.qty);
    update public.sales_items set avg_cost_snapshot = v_line.cost_basis where id = v_line.id;
  end loop;

  update public.sales set status = 'POSTED', total_amount = v_total, updated_at = now() where id = p_sales_id;
  v_journal_id := public.create_journal(v_sales.sales_date, 'sales', p_sales_id, 'POST Sales ' || coalesce(v_sales.sales_no, ''));

  if v_sales.terms = 'CASH' then
    insert into public.receipts(receipt_date, source, ref_type, ref_id, amount, method, is_petty_cash)
    values (v_sales.sales_date, 'SALES_CASH', 'sales', p_sales_id, v_total, 'CASH', false)
    returning id into v_receipt_id;
    perform public.add_journal_line(v_journal_id, v_cash_acc_id, v_total, 0, 'Cash received');
    perform public.add_journal_line(v_journal_id, v_sales_acc_id, 0, v_total, 'Sales revenue');
  else
    insert into public.ar_invoices(sales_id, customer_id, invoice_date, total_amount, outstanding_amount, status)
    values (p_sales_id, v_sales.customer_id, v_sales.sales_date, v_total, v_total, 'UNPAID')
    returning id into v_ar_id;
    perform public.add_journal_line(v_journal_id, v_ar_acc_id, v_total, 0, 'AR created');
    perform public.add_journal_line(v_journal_id, v_sales_acc_id, 0, v_total, 'Sales revenue');
  end if;

  if v_total_cogs > 0 then
    perform public.add_journal_line(v_journal_id, v_cogs_acc_id, v_total_cogs, 0, 'COGS');
    if v_total_cogs_fg > 0 then
      perform public.add_journal_line(v_journal_id, v_inventory_acc_id, 0, v_total_cogs_fg, 'Inventory reduction (FG)');
    end if;
    if v_total_cogs_rm > 0 then
      perform public.add_journal_line(v_journal_id, v_rm_inventory_acc_id, 0, v_total_cogs_rm, 'Inventory reduction (RM)');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'sales_id', p_sales_id, 'journal_id', v_journal_id);
end $$;


-- RPC POST PURCHASE (from 008)
create or replace function public.rpc_post_purchase(p_purchase_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_purchase record;
  v_total numeric(14,2);
  v_journal_id uuid;
  v_ap_id uuid;
  v_line record;
  v_prev_qty numeric(14,3);
  v_prev_avg numeric(14,4);
  v_new_qty numeric(14,3);
  v_new_avg numeric(14,4);
  v_cash_acc_id uuid;
  v_ap_acc_id uuid;
  v_inventory_acc_id uuid;
begin
  select id into v_cash_acc_id from public.accounts where code = '1100';
  select id into v_ap_acc_id from public.accounts where code = '2100';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  
  if v_cash_acc_id is null or v_ap_acc_id is null or v_inventory_acc_id is null then raise exception 'COA Codes missing'; end if;
  
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_purchase.status <> 'DRAFT' then raise exception 'Purchase must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_purchase.purchase_date) then raise exception 'Periode CLOSED'; end if;
  
  select coalesce(sum(subtotal),0) into v_total from public.purchase_items where purchase_id = p_purchase_id;
  if v_total <= 0 then raise exception 'Purchase total must > 0'; end if;

  -- Inventory Increase + Avg Cost
  for v_line in select item_id, qty, unit_cost from public.purchase_items where purchase_id = p_purchase_id loop
    perform public.ensure_stock_row(v_line.item_id);
    select qty_on_hand, avg_cost into v_prev_qty, v_prev_avg from public.inventory_stock where item_id = v_line.item_id for update;
    v_new_qty := coalesce(v_prev_qty, 0) + v_line.qty;
    if v_new_qty > 0 then
      v_new_avg := (coalesce(v_prev_qty, 0) * coalesce(v_prev_avg, 0) + v_line.qty * v_line.unit_cost) / v_new_qty;
    else
      v_new_avg := 0;
    end if;
    update public.inventory_stock set avg_cost = v_new_avg where item_id = v_line.item_id;
    perform public.apply_stock_delta(v_line.item_id, v_line.qty);
  end loop;

  update public.purchases set status = 'POSTED', total_amount = v_total, updated_at = now() where id = p_purchase_id;
  v_journal_id := public.create_journal(v_purchase.purchase_date, 'purchase', p_purchase_id, 'POST Purchase ' || coalesce(v_purchase.purchase_no, ''));

  if v_purchase.terms = 'CASH' then
    perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total, 0, 'Inventory purchased');
    perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, v_total, 'Cash paid');
  else
    insert into public.ap_bills(purchase_id, vendor_id, bill_date, total_amount, outstanding_amount, status)
    values (p_purchase_id, v_purchase.vendor_id, v_purchase.purchase_date, v_total, v_total, 'UNPAID')
    returning id into v_ap_id;
    perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total, 0, 'Inventory purchased');
    perform public.add_journal_line(v_journal_id, v_ap_acc_id, 0, v_total, 'AP created');
  end if;

  return jsonb_build_object('ok', true, 'purchase_id', p_purchase_id, 'journal_id', v_journal_id);
end $$;

-- ============================================================
-- 4. RETURNS
-- ============================================================

-- RPC POST SALES RETURN (011)
create or replace function public.rpc_post_sales_return(p_return_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_ret record; v_sales record; v_ar record; v_total numeric(14,2); v_journal_id uuid; v_line record;
  v_cash_acc_id uuid; v_ar_acc_id uuid; v_ret_acc_id uuid; v_inventory_acc_id uuid; v_rm_inv_acc_id uuid; v_cogs_acc_id uuid;
  v_reduce_ar numeric(14,2); v_refund_cash numeric(14,2);
  v_total_cogs numeric(14,2); v_total_cogs_fg numeric(14,2); v_total_cogs_rm numeric(14,2);
begin
  select id into v_cash_acc_id from public.accounts where code = '1100';
  select id into v_ar_acc_id from public.accounts where code = '1200';
  select id into v_ret_acc_id from public.accounts where code = '4110';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inv_acc_id from public.accounts where code = '1310';
  select id into v_cogs_acc_id from public.accounts where code = '5100';

  select * into v_ret from public.sales_returns where id = p_return_id for update;
  if v_ret.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_ret.return_date) then raise exception 'Periode CLOSED'; end if;

  select * into v_sales from public.sales where id = v_ret.sales_id;
  if v_sales.status <> 'POSTED' then raise exception 'Sales must be POSTED'; end if;

  select coalesce(sum(subtotal),0) into v_total from public.sales_return_items where sales_return_id = p_return_id;
  if v_total <= 0 then raise exception 'Total must be > 0'; end if;

  select
    coalesce(sum(ri.qty * coalesce(ri.cost_snapshot, i.default_price_buy)), 0)::numeric(14,2),
    coalesce(sum(ri.qty * coalesce(ri.cost_snapshot, i.default_price_buy)) filter (where i.type = 'FINISHED_GOOD'), 0)::numeric(14,2),
    coalesce(sum(ri.qty * coalesce(ri.cost_snapshot, i.default_price_buy)) filter (where i.type = 'RAW_MATERIAL'), 0)::numeric(14,2)
  into v_total_cogs, v_total_cogs_fg, v_total_cogs_rm
  from public.sales_return_items ri
  join public.items i on i.id = ri.item_id
  where ri.sales_return_id = p_return_id;

  for v_line in select item_id, qty from public.sales_return_items where sales_return_id = p_return_id loop
    perform public.apply_stock_delta(v_line.item_id, v_line.qty);
  end loop;

  update public.sales_returns set status = 'POSTED', total_amount = v_total, updated_at = now() where id = p_return_id;
  v_journal_id := public.create_journal(v_ret.return_date, 'sales_return', p_return_id, 'Return ' || coalesce(v_sales.sales_no,''));

  if v_sales.terms = 'CASH' then
    perform public.add_journal_line(v_journal_id, v_ret_acc_id, v_total, 0, 'Sales Return');
    perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, v_total, 'Cash Refund');
  else
    select * into v_ar from public.ar_invoices where sales_id = v_sales.id for update;
    if found then
       v_reduce_ar := least(v_ar.outstanding_amount, v_total);
       v_refund_cash := v_total - v_reduce_ar;
       if v_reduce_ar > 0 then
          update public.ar_invoices set outstanding_amount = outstanding_amount - v_reduce_ar, status = case when (outstanding_amount - v_reduce_ar) = 0 then 'PAID' else status end where id = v_ar.id;
       end if;
    else
       v_reduce_ar := 0; v_refund_cash := v_total;
    end if;
    perform public.add_journal_line(v_journal_id, v_ret_acc_id, v_total, 0, 'Sales Return');
    if v_reduce_ar > 0 then perform public.add_journal_line(v_journal_id, v_ar_acc_id, 0, v_reduce_ar, 'Reduce AR'); end if;
    if v_refund_cash > 0 then perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, v_refund_cash, 'Cash Refund'); end if;
  end if;

  if v_total_cogs > 0 then
    if v_total_cogs_fg > 0 then perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total_cogs_fg, 0, 'Inventory recovery (FG)'); end if;
    if v_total_cogs_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_inv_acc_id, v_total_cogs_rm, 0, 'Inventory recovery (RM)'); end if;
    perform public.add_journal_line(v_journal_id, v_cogs_acc_id, 0, v_total_cogs, 'COGS reduction');
  end if;

  return jsonb_build_object('ok', true, 'return_id', p_return_id, 'journal_id', v_journal_id);
end $$;

-- RPC POST PURCHASE RETURN (022)
create or replace function public.rpc_post_purchase_return(p_return_id uuid, p_method text default 'CASH')
returns jsonb language plpgsql security definer as $$
declare
  v_ret record; v_pur record; v_ap record; v_total numeric(14,2); v_journal_id uuid; v_line record;
  v_pay_acc uuid; v_inv_acc uuid; v_rm_acc uuid; v_ap_acc uuid;
  v_reduce_ap numeric(14,2) := 0; v_refund_cash numeric(14,2) := 0;
  v_tot_inv_fg numeric(14,2); v_tot_inv_rm numeric(14,2);
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  v_pay_acc := public.get_payment_account_for_method(p_method);
  select id into v_inv_acc from public.accounts where code = '1300';
  select id into v_rm_acc from public.accounts where code = '1310';
  select id into v_ap_acc from public.accounts where code = '2100';

  select * into v_ret from public.purchase_returns where id = p_return_id for update;
  if v_ret.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_ret.return_date) then raise exception 'Periode CLOSED'; end if;

  select * into v_pur from public.purchases where id = v_ret.purchase_id;
  if v_pur.status <> 'POSTED' then raise exception 'Purchase must be POSTED'; end if;

  select coalesce(sum(subtotal), 0),
         coalesce(sum(pr.qty * coalesce(pr.unit_cost, i.default_price_buy)) filter (where i.type='FINISHED_GOOD'), 0),
         coalesce(sum(pr.qty * coalesce(pr.unit_cost, i.default_price_buy)) filter (where i.type='RAW_MATERIAL'), 0)
  into v_total, v_tot_inv_fg, v_tot_inv_rm
  from public.purchase_return_items pr
  join public.items i on i.id = pr.item_id
  where pr.purchase_return_id = p_return_id;

  if v_total <= 0 then raise exception 'Total > 0 required'; end if;

  for v_line in select item_id, qty from public.purchase_return_items where purchase_return_id = p_return_id loop
    perform public.apply_stock_delta(v_line.item_id, -v_line.qty);
  end loop;

  update public.purchase_returns set status = 'POSTED', total_amount = v_total, updated_at = now() where id = p_return_id;

  if v_pur.terms = 'CASH' then
    v_refund_cash := v_total;
  else
    select * into v_ap from public.ap_bills where purchase_id = v_pur.id for update;
    if found then
      v_reduce_ap := least(v_ap.outstanding_amount, v_total);
      v_refund_cash := v_total - v_reduce_ap;
      update public.ap_bills set
        total_amount = greatest(total_amount - v_total, 0), -- Reduce original amount or just outstanding? 022 reduced total_amount.
        outstanding_amount = greatest(outstanding_amount - v_reduce_ap, 0),
        status = case when outstanding_amount - v_reduce_ap <= 0 then 'PAID' else 'PARTIAL' end
      where id = v_ap.id;
    else
       -- Fallback if no AP found (data corruption context?) -> cash refund
       v_refund_cash := v_total;
    end if;
  end if;

  v_journal_id := public.create_journal(v_ret.return_date, 'purchase_return', p_return_id, 'Return ' || coalesce(v_pur.purchase_no,''));

  if v_refund_cash > 0 then perform public.add_journal_line(v_journal_id, v_pay_acc, v_refund_cash, 0, 'Vendor refund'); end if;
  if v_reduce_ap > 0 then perform public.add_journal_line(v_journal_id, v_ap_acc, v_reduce_ap, 0, 'Reduce AP'); end if;
  if v_tot_inv_fg > 0 then perform public.add_journal_line(v_journal_id, v_inv_acc, 0, v_tot_inv_fg, 'Inv Return (FG)'); end if;
  if v_tot_inv_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_acc, 0, v_tot_inv_rm, 'Inv Return (RM)'); end if;

  return jsonb_build_object('ok', true, 'return_id', p_return_id);
end $$;

-- ============================================================
-- 5. RECEIPT & PAYMENT
-- ============================================================

-- RECEIPT AR (020)
create or replace function public.rpc_create_receipt_ar(p_ar_invoice_id uuid, p_amount numeric, p_receipt_date date, p_method text)
returns jsonb language plpgsql security definer as $$
declare
  v_ar record; v_receipt_id uuid; v_journal_id uuid; v_cash_acc_id uuid; v_ar_acc_id uuid; v_new_outstanding numeric;
begin
  select public.get_payment_account_for_method(p_method) into v_cash_acc_id;
  select id into v_ar_acc_id from public.accounts where code = '1200';
  if p_amount <= 0 then raise exception 'Amount > 0'; end if;
  
  select * into v_ar from public.ar_invoices where id = p_ar_invoice_id for update;
  if not found then raise exception 'AR not found'; end if;
  if v_ar.outstanding_amount <= 0 then raise exception 'Already paid'; end if;
  if p_amount > v_ar.outstanding_amount then raise exception 'Overpayment'; end if;
  
  insert into public.receipts(receipt_date, source, ref_type, ref_id, amount, method, is_petty_cash)
  values (coalesce(p_receipt_date, v_ar.invoice_date), 'AR_PAYMENT', 'ar_invoice', p_ar_invoice_id, p_amount, p_method, false)
  returning id into v_receipt_id;

  v_new_outstanding := v_ar.outstanding_amount - p_amount;
  update public.ar_invoices set outstanding_amount = v_new_outstanding, status = case when v_new_outstanding=0 then 'PAID' else 'PARTIAL' end where id = p_ar_invoice_id;

  v_journal_id := public.create_journal(coalesce(p_receipt_date, v_ar.invoice_date), 'receipt', v_receipt_id, 'AR Receipt');
  perform public.add_journal_line(v_journal_id, v_cash_acc_id, p_amount, 0, 'Cash received');
  perform public.add_journal_line(v_journal_id, v_ar_acc_id, 0, p_amount, 'Reduce AR');

  return jsonb_build_object('ok', true, 'receipt_id', v_receipt_id);
end $$;

-- PAYMENT AP (020)
create or replace function public.rpc_create_payment_ap(p_ap_bill_id uuid, p_amount numeric, p_payment_date date, p_method text)
returns jsonb language plpgsql security definer as $$
declare
  v_ap record; v_pay_id uuid; v_journal_id uuid; v_cash_acc_id uuid; v_ap_acc_id uuid; v_new_outstanding numeric;
begin
  select public.get_payment_account_for_method(p_method) into v_cash_acc_id;
  select id into v_ap_acc_id from public.accounts where code = '2100';
  if p_amount <= 0 then raise exception 'Amount > 0'; end if;

  select * into v_ap from public.ap_bills where id = p_ap_bill_id for update;
  if not found then raise exception 'AP not found'; end if;
  if v_ap.outstanding_amount <= 0 then raise exception 'Already paid'; end if;
  if p_amount > v_ap.outstanding_amount then raise exception 'Overpayment'; end if;

  insert into public.payments(payment_date, source, ref_type, ref_id, amount, method)
  values (coalesce(p_payment_date, v_ap.bill_date), 'AP_PAYMENT', 'ap_bill', p_ap_bill_id, p_amount, p_method)
  returning id into v_pay_id;

  v_new_outstanding := v_ap.outstanding_amount - p_amount;
  update public.ap_bills set outstanding_amount = v_new_outstanding, status = case when v_new_outstanding=0 then 'PAID' else 'PARTIAL' end where id = p_ap_bill_id;

  v_journal_id := public.create_journal(coalesce(p_payment_date, v_ap.bill_date), 'payment', v_pay_id, 'AP Payment');
  perform public.add_journal_line(v_journal_id, v_ap_acc_id, p_amount, 0, 'Reduce AP');
  perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, p_amount, 'Cash paid');

  return jsonb_build_object('ok', true, 'payment_id', v_pay_id);
end $$;


-- ============================================================
-- 6. ADJUSTMENTS & OPENING STOCK
-- ============================================================

-- ADJUST STOCK (020)
create or replace function public.rpc_adjust_stock(p_item_id uuid, p_qty_delta numeric, p_reason text)
returns jsonb language plpgsql security definer as $$
declare
  v_journal_id uuid; v_adj_id uuid; v_inv_acc uuid; v_exp_acc uuid;
begin
  if public.is_date_in_closed_period(current_date) then raise exception 'Periode CLOSED'; end if;
  select id into v_inv_acc from public.accounts where code = '1300';
  select id into v_exp_acc from public.accounts where code = '6100';

  insert into public.inventory_adjustments(item_id, qty_delta, reason, adjusted_at)
  values (p_item_id, p_qty_delta, p_reason, now())
  returning id into v_adj_id;

  perform public.apply_stock_delta(p_item_id, p_qty_delta);
  
  v_journal_id := public.create_journal(current_date, 'adjustment', v_adj_id, 'Adj: ' || coalesce(p_reason, ''));
  if p_qty_delta > 0 then
    perform public.add_journal_line(v_journal_id, v_inv_acc, abs(0), 0, 'Stock Gain'); -- Cost unknown/zero for now as per 010. 
    -- 010 had v_journal_amount := 0. 
    perform public.add_journal_line(v_journal_id, v_exp_acc, 0, abs(0), 'Adj Gain');
  else
    perform public.add_journal_line(v_journal_id, v_exp_acc, abs(0), 0, 'Adj Loss');
    perform public.add_journal_line(v_journal_id, v_inv_acc, 0, abs(0), 'Stock Loss');
  end if;
  return jsonb_build_object('ok', true, 'id', v_adj_id);
end $$;

-- OPENING STOCK (020)
create or replace function public.rpc_set_opening_stock(p_item_id uuid, p_qty numeric, p_as_of_date date, p_reason text default 'Opening')
returns jsonb language plpgsql security definer as $$
declare
  v_curr numeric; v_delta numeric; v_adj_id uuid; v_cost numeric;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_qty < 0 then raise exception 'Qty >= 0'; end if;
  if public.is_date_in_closed_period(p_as_of_date) then raise exception 'Periode CLOSED'; end if;

  select qty_on_hand into v_curr from public.inventory_stock where item_id = p_item_id;
  v_delta := p_qty - coalesce(v_curr, 0);
  if abs(v_delta) < 0.0001 then raise exception 'No change'; end if;

  insert into public.inventory_adjustments(item_id, qty_delta, reason, adjusted_at)
  values (p_item_id, v_delta, p_reason, p_as_of_date)
  returning id into v_adj_id;

  perform public.apply_stock_delta(p_item_id, v_delta);
  select default_price_buy into v_cost from public.items where id = p_item_id;
  update public.inventory_stock set avg_cost = case when p_qty > 0 then coalesce(v_cost,0) else 0 end where item_id = p_item_id;

  return jsonb_build_object('ok', true, 'id', v_adj_id);
end $$;


-- ============================================================
-- 7. DELETE DRAFTS
-- ============================================================
create or replace function public.rpc_delete_sales_draft(p_sales_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_sale record;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select * into v_sale from public.sales where id = p_sales_id for update;
  if v_sale.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_sale.sales_date) then raise exception 'Periode CLOSED'; end if;
  delete from public.sales_items where sales_id = p_sales_id;
  delete from public.sales where id = p_sales_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rpc_delete_purchase_draft(p_purchase_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_pur record;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  select * into v_pur from public.purchases where id = p_purchase_id for update;
  if v_pur.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_pur.purchase_date) then raise exception 'Periode CLOSED'; end if;
  delete from public.purchase_items where purchase_id = p_purchase_id;
  delete from public.purchases where id = p_purchase_id;
  return jsonb_build_object('ok', true);
end $$;
