-- ============================================================
-- 0049_guard_negative_stock.sql
-- Prevent negative stock on posting/adjustment
-- ============================================================

-- POST SALES: ensure on-hand >= qty before deduction
create or replace function public.rpc_post_sales(p_sales_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_sales record;
  v_items_total numeric(14,2);
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
  v_sales_disc_acc_id uuid;
  v_inventory_acc_id uuid;
  v_rm_inventory_acc_id uuid;
  v_cogs_acc_id uuid;
  v_method text;
  v_on_hand numeric(14,3);
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select id into v_ar_acc_id from public.accounts where code = '1200';
  select id into v_sales_acc_id from public.accounts where code = '4100';
  select id into v_sales_disc_acc_id from public.accounts where code = '4120';
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

  -- Recompute line subtotals to avoid client tampering
  update public.sales_items
  set subtotal = round(qty * unit_price, 2)
  where sales_id = p_sales_id;

  select coalesce(sum(qty * unit_price),0) into v_items_total
  from public.sales_items
  where sales_id = p_sales_id;
  if v_items_total <= 0 then raise exception 'Sales total must be > 0'; end if;

  v_total := v_items_total + coalesce(v_sales.shipping_fee, 0) - coalesce(v_sales.discount_amount, 0);
  if v_total < 0 then raise exception 'Sales total invalid'; end if;

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

  -- Inventory decrease + snapshot (guard negative stock)
  for v_line in select si.id, si.item_id, si.qty, coalesce(inv.avg_cost, i.default_price_buy)::numeric(14,4) as cost_basis
                from public.sales_items si
                join public.items i on i.id = si.item_id
                left join public.inventory_stock inv on inv.item_id = i.id
                where si.sales_id = p_sales_id loop
    perform public.ensure_stock_row(v_line.item_id);
    select qty_on_hand into v_on_hand from public.inventory_stock where item_id = v_line.item_id for update;
    if coalesce(v_on_hand, 0) < v_line.qty then
      raise exception 'Insufficient stock for item %', v_line.item_id;
    end if;
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
  else
    insert into public.ar_invoices(sales_id, customer_id, invoice_date, total_amount, outstanding_amount, status)
    values (p_sales_id, v_sales.customer_id, v_sales.sales_date, v_total, v_total, 'UNPAID')
    returning id into v_ar_id;
    perform public.add_journal_line(v_journal_id, v_ar_acc_id, v_total, 0, 'AR created');
  end if;

  -- Revenue (gross) + discount
  perform public.add_journal_line(v_journal_id, v_sales_acc_id, 0, (v_items_total + coalesce(v_sales.shipping_fee, 0)), 'Sales revenue');
  if coalesce(v_sales.discount_amount, 0) > 0 and v_sales_disc_acc_id is not null then
    perform public.add_journal_line(v_journal_id, v_sales_disc_acc_id, coalesce(v_sales.discount_amount, 0), 0, 'Sales discount');
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

-- ADJUST STOCK: prevent resulting negative stock
create or replace function public.rpc_adjust_stock(p_item_id uuid, p_qty_delta numeric, p_reason text)
returns jsonb language plpgsql security definer as $$
declare
  v_journal_id uuid; v_adj_id uuid; v_inv_acc uuid; v_exp_acc uuid;
  v_cost numeric; v_journal_amount numeric; v_on_hand numeric(14,3);
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  if p_qty_delta is null or abs(p_qty_delta) < 0.0001 then
    raise exception 'Qty delta must not be zero';
  end if;
  if public.is_date_in_closed_period(current_date) then raise exception 'Periode CLOSED'; end if;
  select id into v_inv_acc from public.accounts where code = '1300';
  select id into v_exp_acc from public.accounts where code = '6100';
  -- Get default price buy as fallback cost
  select default_price_buy into v_cost from public.items where id = p_item_id;

  -- Ensure stock row and lock it for consistent cost lookup
  perform public.ensure_stock_row(p_item_id);
  select qty_on_hand, coalesce(avg_cost, v_cost, 0)
    into v_on_hand, v_cost
  from public.inventory_stock
  where item_id = p_item_id
  for update;

  if coalesce(v_on_hand, 0) + p_qty_delta < 0 then
    raise exception 'Insufficient stock for adjustment';
  end if;

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
