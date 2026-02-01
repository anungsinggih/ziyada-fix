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
  v_method text;
begin
  select id into v_ar_acc_id from public.accounts where code = '1200';
  select id into v_sales_acc_id from public.accounts where code = '4100';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inventory_acc_id from public.accounts where code = '1310';
  select id into v_cogs_acc_id from public.accounts where code = '5100';
  
  if v_ar_acc_id is null or v_sales_acc_id is null or v_inventory_acc_id is null or v_rm_inventory_acc_id is null or v_cogs_acc_id is null then
    raise exception 'COA Codes missing (1200, 4100, 1300, 1310, 5100)';
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
    coalesce(sum(si.qty * coalesce(inv.avg_cost, i.default_price_buy)) filter (where i.type in ('FINISHED_GOOD','TRADED')), 0)::numeric(14,2),
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
    v_method := upper(coalesce(v_sales.payment_method_code, 'CASH'));
    v_cash_acc_id := public.get_payment_account_for_method(v_method);
    insert into public.receipts(receipt_date, source, ref_type, ref_id, amount, method, is_petty_cash)
    values (v_sales.sales_date, 'SALES_CASH', 'sales', p_sales_id, v_total, v_method, false)
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

  return jsonb_build_object(
    'ok', true,
    'sales_id', p_sales_id,
    'journal_id', v_journal_id,
    'receipt_id', v_receipt_id,
    'ar_invoice_id', v_ar_id
  );
end $$;


-- RPC POST PURCHASE (from 008)
create or replace function public.rpc_post_purchase(p_purchase_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_purchase record;
  v_total numeric(14,2);
  v_total_fg numeric(14,2);
  v_total_rm numeric(14,2);
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
  v_rm_inventory_acc_id uuid;
  v_method text;
begin
  select id into v_ap_acc_id from public.accounts where code = '2100';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inventory_acc_id from public.accounts where code = '1310';
  
  if v_ap_acc_id is null or v_inventory_acc_id is null or v_rm_inventory_acc_id is null then
    raise exception 'COA Codes missing (2100, 1300, 1310)';
  end if;
  
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_purchase.status <> 'DRAFT' then raise exception 'Purchase must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_purchase.purchase_date) then raise exception 'Periode CLOSED'; end if;
  
  select
    coalesce(sum(pi.subtotal),0),
    coalesce(sum(pi.subtotal) filter (where i.type in ('FINISHED_GOOD','TRADED')),0),
    coalesce(sum(pi.subtotal) filter (where i.type = 'RAW_MATERIAL'),0)
  into v_total, v_total_fg, v_total_rm
  from public.purchase_items pi
  join public.items i on i.id = pi.item_id
  where pi.purchase_id = p_purchase_id;
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
    v_method := upper(coalesce(v_purchase.payment_method_code, 'CASH'));
    v_cash_acc_id := public.get_payment_account_for_method(v_method);
    if v_total_fg > 0 then perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total_fg, 0, 'Inventory purchased (FG/Traded)'); end if;
    if v_total_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_inventory_acc_id, v_total_rm, 0, 'Inventory purchased (RM)'); end if;
    perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, v_total, 'Cash paid');
  else
    insert into public.ap_bills(purchase_id, vendor_id, bill_date, total_amount, outstanding_amount, status)
    values (p_purchase_id, v_purchase.vendor_id, v_purchase.purchase_date, v_total, v_total, 'UNPAID')
    returning id into v_ap_id;
    if v_total_fg > 0 then perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total_fg, 0, 'Inventory purchased (FG/Traded)'); end if;
    if v_total_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_inventory_acc_id, v_total_rm, 0, 'Inventory purchased (RM)'); end if;
    perform public.add_journal_line(v_journal_id, v_ap_acc_id, 0, v_total, 'AP created');
  end if;

  return jsonb_build_object(
    'ok', true,
    'purchase_id', p_purchase_id,
    'journal_id', v_journal_id,
    'ap_bill_id', v_ap_id
  );
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
    coalesce(sum(ri.qty * coalesce(nullif(ri.cost_snapshot, 0), si.avg_cost_snapshot, i.default_price_buy)), 0)::numeric(14,2),
    coalesce(sum(ri.qty * coalesce(nullif(ri.cost_snapshot, 0), si.avg_cost_snapshot, i.default_price_buy)) filter (where i.type in ('FINISHED_GOOD','TRADED')), 0)::numeric(14,2),
    coalesce(sum(ri.qty * coalesce(nullif(ri.cost_snapshot, 0), si.avg_cost_snapshot, i.default_price_buy)) filter (where i.type = 'RAW_MATERIAL'), 0)::numeric(14,2)
  into v_total_cogs, v_total_cogs_fg, v_total_cogs_rm
  from public.sales_return_items ri
  join public.items i on i.id = ri.item_id
  join public.sales_items si on si.sales_id = v_ret.sales_id and si.item_id = ri.item_id
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
          update public.ar_invoices
          set outstanding_amount = outstanding_amount - v_reduce_ar,
              status = case when (outstanding_amount - v_reduce_ar) = 0 then 'PAID' else 'PARTIAL' end
          where id = v_ar.id;
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
         coalesce(sum(pr.qty * coalesce(pr.unit_cost, i.default_price_buy)) filter (where i.type in ('FINISHED_GOOD','TRADED')), 0),
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
create or replace function public.rpc_create_receipt_ar(p_ar_invoice_id uuid, p_amount numeric, p_receipt_date date, p_method text, p_is_petty_cash boolean default false)
returns jsonb language plpgsql security definer as $$
declare
  v_ar record; v_receipt_id uuid; v_journal_id uuid; v_cash_acc_id uuid; v_ar_acc_id uuid; v_new_outstanding numeric; v_method text;
begin
  v_method := upper(coalesce(p_method, 'CASH'));
  select public.get_payment_account_for_method(v_method) into v_cash_acc_id;
  select id into v_ar_acc_id from public.accounts where code = '1200';
  if p_amount <= 0 then raise exception 'Amount > 0'; end if;
  if p_is_petty_cash and v_method <> 'CASH' then raise exception 'Petty cash must use CASH method'; end if;
  if p_is_petty_cash and p_amount > 500000 then raise exception 'Petty cash max 500000'; end if;
  
  select * into v_ar from public.ar_invoices where id = p_ar_invoice_id for update;
  if not found then raise exception 'AR not found'; end if;
  if v_ar.outstanding_amount <= 0 then raise exception 'Already paid'; end if;
  if p_amount > v_ar.outstanding_amount then raise exception 'Overpayment'; end if;
  
  v_new_outstanding := v_ar.outstanding_amount - p_amount;
  if public.is_date_in_closed_period(coalesce(p_receipt_date, v_ar.invoice_date)) then raise exception 'Periode CLOSED'; end if;

  insert into public.receipts(receipt_date, source, ref_type, ref_id, amount, method, is_petty_cash)
  values (coalesce(p_receipt_date, v_ar.invoice_date), 'AR_PAYMENT', 'ar_invoice', p_ar_invoice_id, p_amount, v_method, coalesce(p_is_petty_cash, false))
  returning id into v_receipt_id;

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
  v_ap record; v_pay_id uuid; v_journal_id uuid; v_cash_acc_id uuid; v_ap_acc_id uuid; v_new_outstanding numeric; v_method text;
begin
  v_method := upper(coalesce(p_method, 'CASH'));
  select public.get_payment_account_for_method(v_method) into v_cash_acc_id;
  select id into v_ap_acc_id from public.accounts where code = '2100';
  if p_amount <= 0 then raise exception 'Amount > 0'; end if;

  select * into v_ap from public.ap_bills where id = p_ap_bill_id for update;
  if not found then raise exception 'AP not found'; end if;
  if v_ap.outstanding_amount <= 0 then raise exception 'Already paid'; end if;
  if p_amount > v_ap.outstanding_amount then raise exception 'Overpayment'; end if;

  v_new_outstanding := v_ap.outstanding_amount - p_amount;
  if public.is_date_in_closed_period(coalesce(p_payment_date, v_ap.bill_date)) then raise exception 'Periode CLOSED'; end if;

  insert into public.payments(payment_date, source, ref_type, ref_id, amount, method)
  values (coalesce(p_payment_date, v_ap.bill_date), 'AP_PAYMENT', 'ap_bill', p_ap_bill_id, p_amount, v_method)
  returning id into v_pay_id;

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
  v_cost numeric; v_journal_amount numeric;
begin
  if public.is_date_in_closed_period(current_date) then raise exception 'Periode CLOSED'; end if;
  select id into v_inv_acc from public.accounts where code = '1300';
  select id into v_exp_acc from public.accounts where code = '6100';
  -- Get default price buy as fallback cost
  select default_price_buy into v_cost from public.items where id = p_item_id;

  -- Ensure stock row and lock it for consistent cost lookup
  perform public.ensure_stock_row(p_item_id);
  select coalesce(avg_cost, v_cost, 0)
    into v_cost
  from public.inventory_stock
  where item_id = p_item_id
  for update;

  insert into public.inventory_adjustments(item_id, qty_delta, reason, adjusted_at)
  values (p_item_id, p_qty_delta, p_reason, now())
  returning id into v_adj_id;

  perform public.apply_stock_delta(p_item_id, p_qty_delta);
  
  v_journal_id := public.create_journal(current_date, 'adjustment', v_adj_id, 'Adj: ' || coalesce(p_reason, ''));
  v_journal_amount := abs(p_qty_delta) * coalesce(v_cost, 0);
  if p_qty_delta > 0 then
    if v_journal_amount > 0 then
      perform public.add_journal_line(v_journal_id, v_inv_acc, v_journal_amount, 0, 'Stock Gain');
      perform public.add_journal_line(v_journal_id, v_exp_acc, 0, v_journal_amount, 'Adj Gain');
    end if;
  else
    if v_journal_amount > 0 then
      perform public.add_journal_line(v_journal_id, v_exp_acc, v_journal_amount, 0, 'Adj Loss');
      perform public.add_journal_line(v_journal_id, v_inv_acc, 0, v_journal_amount, 'Stock Loss');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_adj_id);
end $$;

-- OPENING STOCK (020)
create or replace function public.rpc_set_opening_stock(p_item_id uuid, p_qty numeric, p_as_of_date date, p_reason text default 'Opening')
returns jsonb language plpgsql security definer as $$
declare
  v_curr numeric; v_delta numeric; v_adj_id uuid; v_cost numeric; v_reason text;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_qty < 0 then raise exception 'Qty >= 0'; end if;
  if public.is_date_in_closed_period(p_as_of_date) then raise exception 'Periode CLOSED'; end if;

  -- Opening stock only once per item
  if exists (
    select 1
    from public.inventory_adjustments
    where item_id = p_item_id
      and (reason ilike 'opening%' or reason ilike '%import initial stock%')
  ) then
    raise exception 'Opening stock already set for this item';
  end if;

  v_reason := 'Opening Stock';
  if coalesce(trim(p_reason), '') <> '' then
    if p_reason ilike 'opening stock%' then
      v_reason := trim(p_reason);
    elsif p_reason ilike 'opening%' then
      v_reason := 'Opening Stock';
    else
      v_reason := 'Opening Stock - ' || trim(p_reason);
    end if;
  end if;

  perform public.ensure_stock_row(p_item_id);
  select qty_on_hand into v_curr from public.inventory_stock where item_id = p_item_id for update;
  v_delta := p_qty - coalesce(v_curr, 0);
  if abs(v_delta) < 0.0001 then raise exception 'No change'; end if;

  insert into public.inventory_adjustments(item_id, qty_delta, reason, adjusted_at)
  values (p_item_id, v_delta, v_reason, p_as_of_date)
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

-- ============================================================
-- ADDITIONAL RPCs (Consolidated from 0007, 0009)
-- ============================================================

-- Helper function to generate slug from name (for codes) [from 0007]
create or replace function public.slugify(value text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(trim(value)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Primary Import RPC [from 0007]
create or replace function public.import_master_data(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    row_data jsonb;
    
    -- IDs
    v_brand_id uuid;
    v_category_id uuid;
    v_parent_id uuid;
    v_uom_id uuid;
    v_size_id uuid;
    v_color_id uuid;
    
    -- Names & Codes
    v_brand_name text;
    v_category_name text;
    v_parent_name text;
    v_parent_code text;
    v_uom_name text;
    v_size_name text;
    v_color_name text;
    
    v_item_sku text;
    v_item_name text;
    v_item_type text;
    
    v_price_umum numeric;
    v_price_khusus numeric;
    v_def_price_buy numeric;
    v_min_stock numeric;
    v_initial_stock numeric;
    
    -- Stats
    v_processed_count int := 0;
    v_inserted_count int := 0;
    v_updated_count int := 0;
    v_item_id uuid;
begin
    -- Iterate through rows
    for row_data in select * from jsonb_array_elements(data)
    loop
        v_processed_count := v_processed_count + 1;
        
        -- 1. Extract values safely
        v_item_sku := btrim(coalesce(row_data->>'sku', ''));
        v_item_name := btrim(coalesce(row_data->>'name', ''));
        
        -- Skip invalid rows
        if v_item_sku = '' or v_item_name = '' then
            continue;
        end if;
        
        -- 2. BRAND (Optional)
        v_brand_name := btrim(coalesce(row_data->>'brand_name', ''));
        v_brand_id := null;
        if v_brand_name <> '' then
            insert into brands (name, is_active) values (v_brand_name, true)
            on conflict (name) do update set updated_at = now() returning id into v_brand_id;
        end if;
        
        -- 3. CATEGORY (Optional)
        v_category_name := btrim(coalesce(row_data->>'category_name', ''));
        v_category_id := null;
        if v_category_name <> '' then
             insert into categories (name, is_active) values (v_category_name, true)
            on conflict (name) do update set updated_at = now() returning id into v_category_id;
        end if;
        
        -- 4. PARENT PRODUCT (Optional but recommended)
        v_parent_name := btrim(coalesce(row_data->>'parent_name', ''));
        v_parent_code := btrim(coalesce(row_data->>'parent_code', ''));

        if v_parent_name = '' and v_parent_code = '' then
            v_parent_name := v_item_name;
        end if;

        -- Create/Get Parent
        v_parent_id := null;
        
        -- A. Try lookup by CODE first (if provided)
        if v_parent_code <> '' then
            select id into v_parent_id from product_parents where code = v_parent_code limit 1;
        end if;

        -- B. If not found by code, try lookup by NAME
        if v_parent_id is null and v_parent_name <> '' then
             select id into v_parent_id 
             from product_parents 
             where name = v_parent_name 
             and coalesce(brand_id::text, '') = coalesce(v_brand_id::text, '') 
             limit 1;
        end if;
        
        if v_parent_id is null then
            -- Insert new parent
            insert into product_parents (name, code, brand_id, category_id, is_active)
            values (
                v_parent_name, 
                case when v_parent_code = '' then null else v_parent_code end, 
                v_brand_id, v_category_id, true
            )
            on conflict (code) do update set updated_at = now() returning id into v_parent_id;
            
             if v_parent_id is null then
                select id into v_parent_id from product_parents where name = v_parent_name limit 1;
             end if;
             
        else
            -- Update existing parent
            update product_parents 
            set brand_id = coalesce(v_brand_id, brand_id),
                category_id = coalesce(v_category_id, category_id),
                code = case when v_parent_code <> '' then v_parent_code else code end,
                updated_at = now()
            where id = v_parent_id;
        end if;
        
        -- 5. ATTRIBUTES (UOM, Size, Color)
        -- UoM
        v_uom_name := btrim(coalesce(row_data->>'uom_name', 'PCS'));
        if v_uom_name = '' then v_uom_name := 'PCS'; end if;
        
        select id into v_uom_id from uoms where code = upper(slugify(v_uom_name)) or name = v_uom_name limit 1;
        if v_uom_id is null then
            insert into uoms (code, name, is_active)
            values (upper(slugify(v_uom_name)), v_uom_name, true)
            on conflict (code) do update set updated_at = now() returning id into v_uom_id;
        end if;

        -- Size
        v_size_name := btrim(coalesce(row_data->>'size_name', ''));
        v_size_id := null;
        if v_size_name <> '' then
            select id into v_size_id from sizes where code = upper(slugify(v_size_name)) or name = v_size_name limit 1;
            if v_size_id is null then
                insert into sizes (code, name, is_active)
                values (upper(slugify(v_size_name)), v_size_name, true)
                on conflict (code) do update set updated_at = now() returning id into v_size_id;
            end if;
        end if;

        -- Color
        v_color_name := btrim(coalesce(row_data->>'color_name', ''));
        v_color_id := null;
        if v_color_name <> '' then
            select id into v_color_id from colors where code = upper(slugify(v_color_name)) or name = v_color_name limit 1;
            if v_color_id is null then
                insert into colors (code, name, is_active)
                values (upper(slugify(v_color_name)), v_color_name, true)
                on conflict (code) do update set updated_at = now() returning id into v_color_id;
            end if;
        end if;

        -- 6. UPSERT ITEM
        v_item_type := coalesce(row_data->>'type', 'FINISHED_GOOD');
        if v_item_type not in ('FINISHED_GOOD','RAW_MATERIAL','TRADED') then
            v_item_type := 'FINISHED_GOOD';
        end if;
        v_price_umum := coalesce((row_data->>'price_umum')::numeric, 0);
        v_price_khusus := coalesce((row_data->>'price_khusus')::numeric, 0);
        v_def_price_buy := coalesce((row_data->>'purchase_price')::numeric, 0);
        v_min_stock := coalesce((row_data->>'min_stock')::numeric, 0);
        v_initial_stock := coalesce((row_data->>'initial_stock')::numeric, 0);
        
        insert into items (
            sku, name, type, parent_id,
            uom_id, size_id, color_id,
            price_umum, price_khusus, default_price_buy, min_stock,
            is_active
        )
        values (
            v_item_sku, v_item_name, v_item_type::item_type, v_parent_id,
            v_uom_id, v_size_id, v_color_id,
            v_price_umum, v_price_khusus, v_def_price_buy, v_min_stock,
            true
        )
        on conflict (sku) do update
        set
            name = excluded.name,
            parent_id = excluded.parent_id,
            uom_id = excluded.uom_id,
            size_id = excluded.size_id,
            color_id = excluded.color_id,
            price_umum = excluded.price_umum,
            price_khusus = excluded.price_khusus,
            default_price_buy = excluded.default_price_buy,
            min_stock = excluded.min_stock,
            updated_at = now()
        returning id into v_item_id;
            
        if found then
            v_updated_count := v_updated_count + 1;
        else
            v_inserted_count := v_inserted_count + 1;
        end if;
        
        -- 7. CREATE/UPDATE INVENTORY STOCK & LOG ADJUSTMENT if initial_stock > 0
        if v_initial_stock > 0 then
            -- Create adjustment log
            insert into public.inventory_adjustments (item_id, qty_delta, reason, adjusted_at)
            values (v_item_id, v_initial_stock, 'Opening Stock', now());

            -- Upsert stock with cost
            insert into public.inventory_stock (item_id, qty_on_hand, avg_cost, updated_at)
            values (v_item_id, v_initial_stock, v_def_price_buy, now())
            on conflict (item_id) do update
            set 
                -- Weighted Average Cost Calculation
                avg_cost = case 
                    when (inventory_stock.qty_on_hand + excluded.qty_on_hand) > 0 then
                        ((inventory_stock.qty_on_hand * coalesce(inventory_stock.avg_cost, 0)) + (excluded.qty_on_hand * excluded.avg_cost)) 
                        / (inventory_stock.qty_on_hand + excluded.qty_on_hand)
                    else excluded.avg_cost
                end,
                qty_on_hand = inventory_stock.qty_on_hand + excluded.qty_on_hand,
                updated_at = now();
        end if;
        
    end loop;

    return jsonb_build_object(
        'success', true,
        'processed', v_processed_count,
        'inserted_or_updated', v_processed_count
    );
end;
$$;

-- Product Save Complete RPC [from 0009]
create or replace function public.rpc_save_product_complete(
    p_parent_id uuid,
    p_parent_code text,
    p_parent_name text,
    p_brand_id uuid,
    p_category_id uuid,
    p_image_url text,
    p_description text,
    p_variants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_parent_id uuid;
    v_variant jsonb;
    v_variant_id uuid;
begin
    -- 1. UPSERT PARENT
    if p_parent_id is null then
        insert into product_parents (
            code, name, brand_id, category_id, image_url, description, is_active
        ) values (
            nullif(trim(p_parent_code), ''), 
            trim(p_parent_name), 
            p_brand_id, 
            p_category_id, 
            nullif(trim(p_image_url), ''),
            nullif(trim(p_description), ''),
            true
        )
        returning id into v_parent_id;
    else
        update product_parents
        set 
            code = nullif(trim(p_parent_code), ''),
            name = trim(p_parent_name),
            brand_id = p_brand_id,
            category_id = p_category_id,
            image_url = nullif(trim(p_image_url), ''),
            description = nullif(trim(p_description), ''),
            updated_at = now()
        where id = p_parent_id
        returning id into v_parent_id;
        
        if v_parent_id is null then
             raise exception 'Parent not found with ID %', p_parent_id;
        end if;
    end if;

    -- 2. PROCESS VARIANTS
    for v_variant in select * from jsonb_array_elements(p_variants)
    loop
        -- Determine Variant ID (if exists)
        v_variant_id := (v_variant->>'id')::uuid;

        if v_variant_id is null then
            -- INSERT NEW VARIANT
            insert into items (
                parent_id,
                sku, 
                name, 
                type,
                uom_id, 
                size_id, 
                color_id,
                price_umum, 
                price_khusus, 
                default_price_buy, 
                min_stock,
                is_active
            ) values (
                v_parent_id,
                trim(v_variant->>'sku'),
                trim(v_variant->>'name'),
                (v_variant->>'type')::item_type,
                (v_variant->>'uom_id')::uuid,
                (v_variant->>'size_id')::uuid,
                (v_variant->>'color_id')::uuid,
                coalesce((v_variant->>'price_umum')::numeric, 0),
                coalesce((v_variant->>'price_khusus')::numeric, 0),
                coalesce((v_variant->>'purchase_price')::numeric, 0),
                coalesce((v_variant->>'min_stock')::numeric, 0),
                coalesce((v_variant->>'is_active')::boolean, true)
            )
            returning id into v_variant_id;
        else
            -- UPDATE EXISTING VARIANT
            update items
            set 
                sku = trim(v_variant->>'sku'),
                name = trim(v_variant->>'name'),
                type = (v_variant->>'type')::item_type,
                uom_id = (v_variant->>'uom_id')::uuid,
                size_id = (v_variant->>'size_id')::uuid,
                color_id = (v_variant->>'color_id')::uuid,
                price_umum = coalesce((v_variant->>'price_umum')::numeric, 0),
                price_khusus = coalesce((v_variant->>'price_khusus')::numeric, 0),
                default_price_buy = coalesce((v_variant->>'purchase_price')::numeric, 0),
                min_stock = coalesce((v_variant->>'min_stock')::numeric, 0),
                is_active = coalesce((v_variant->>'is_active')::boolean, true),
                updated_at = now()
            where id = v_variant_id;
        end if;

    end loop;

    -- Return the Parent ID
    return jsonb_build_object(
        'success', true,
        'parent_id', v_parent_id
    );
end;
$$;
