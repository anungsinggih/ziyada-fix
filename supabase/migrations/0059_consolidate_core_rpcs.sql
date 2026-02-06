-- ============================================================
-- 0059_consolidate_core_rpcs.sql
-- Consolidate core RPC definitions (single source of truth)
-- ============================================================

-- ------------------------------------------------------------
-- rpc_post_sales
-- ------------------------------------------------------------
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
  if coalesce(v_sales.discount_amount, 0) > 0 and v_sales_disc_acc_id is null then
    raise exception 'Sales discount account (4120) is not configured';
  end if;

  -- Recompute line subtotals to avoid client tampering
  update public.sales_items
  set subtotal = round(qty * unit_price, 2)
  where sales_id = p_sales_id;

  select coalesce(sum(qty * unit_price),0) into v_items_total
  from public.sales_items
  where sales_id = p_sales_id;
  if v_items_total <= 0 then raise exception 'Sales total must be > 0'; end if;

  v_total := v_items_total + coalesce(v_sales.shipping_fee, 0) - coalesce(v_sales.discount_amount, 0);
  if v_total < 0 then raise exception 'Sales total invalid (check discount/ongkir)'; end if;

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
  if coalesce(v_sales.discount_amount, 0) > 0 then
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

-- ------------------------------------------------------------
-- rpc_post_purchase
-- ------------------------------------------------------------
create or replace function public.rpc_post_purchase(p_purchase_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_purchase record;
  v_items_total numeric(14,2);
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
  v_purchase_disc_acc_id uuid;
  v_method text;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select id into v_ap_acc_id from public.accounts where code = '2100';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inventory_acc_id from public.accounts where code = '1310';
  select id into v_purchase_disc_acc_id from public.accounts where code = '5200';
  
  if v_ap_acc_id is null or v_inventory_acc_id is null or v_rm_inventory_acc_id is null then
    raise exception 'COA Codes missing (2100, 1300, 1310)';
  end if;
  
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_purchase.status <> 'DRAFT' then raise exception 'Purchase must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_purchase.purchase_date) then raise exception 'Periode CLOSED'; end if;
  if coalesce(v_purchase.discount_amount, 0) > 0 and v_purchase_disc_acc_id is null then
    raise exception 'Purchase discount account (5200) is not configured';
  end if;

  -- Recompute line subtotals to avoid client tampering
  update public.purchase_items
  set subtotal = round(qty * unit_cost, 2)
  where purchase_id = p_purchase_id;
  
  select
    coalesce(sum(pi.qty * pi.unit_cost),0),
    coalesce(sum(pi.qty * pi.unit_cost) filter (where i.type in ('FINISHED_GOOD','TRADED')),0),
    coalesce(sum(pi.qty * pi.unit_cost) filter (where i.type = 'RAW_MATERIAL'),0)
  into v_items_total, v_total_fg, v_total_rm
  from public.purchase_items pi
  join public.items i on i.id = pi.item_id
  where pi.purchase_id = p_purchase_id;

  if v_items_total <= 0 then raise exception 'Purchase total must > 0'; end if;

  v_total := v_items_total - coalesce(v_purchase.discount_amount, 0);
  if v_total < 0 then raise exception 'Purchase total invalid (check discount)'; end if;

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
    if coalesce(v_purchase.discount_amount, 0) > 0 then
      perform public.add_journal_line(v_journal_id, v_purchase_disc_acc_id, 0, coalesce(v_purchase.discount_amount, 0), 'Purchase discount');
    end if;
    perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, v_total, 'Cash paid');
  else
    insert into public.ap_bills(purchase_id, vendor_id, bill_date, total_amount, outstanding_amount, status)
    values (p_purchase_id, v_purchase.vendor_id, v_purchase.purchase_date, v_total, v_total, 'UNPAID')
    returning id into v_ap_id;
    if v_total_fg > 0 then perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total_fg, 0, 'Inventory purchased (FG/Traded)'); end if;
    if v_total_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_inventory_acc_id, v_total_rm, 0, 'Inventory purchased (RM)'); end if;
    if coalesce(v_purchase.discount_amount, 0) > 0 then
      perform public.add_journal_line(v_journal_id, v_purchase_disc_acc_id, 0, coalesce(v_purchase.discount_amount, 0), 'Purchase discount');
    end if;
    perform public.add_journal_line(v_journal_id, v_ap_acc_id, 0, v_total, 'AP created');
  end if;

  return jsonb_build_object(
    'ok', true,
    'purchase_id', p_purchase_id,
    'journal_id', v_journal_id,
    'ap_bill_id', v_ap_id
  );
end $$;

-- ------------------------------------------------------------
-- rpc_post_sales_return
-- ------------------------------------------------------------
create or replace function public.rpc_post_sales_return(p_return_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_ret record;
  v_sales record;
  v_ar record;
  v_total numeric(14,2);
  v_journal_id uuid;
  v_line record;
  v_cash_acc_id uuid;
  v_ar_acc_id uuid;
  v_ret_acc_id uuid;
  v_inventory_acc_id uuid;
  v_rm_inv_acc_id uuid;
  v_cogs_acc_id uuid;
  v_reduce_ar numeric(14,2);
  v_refund_cash numeric(14,2);
  v_total_cogs numeric(14,2);
  v_total_cogs_fg numeric(14,2);
  v_total_cogs_rm numeric(14,2);
  v_method text;
  v_sold_qty numeric(14,3);
  v_returned_qty numeric(14,3);
  v_remaining_qty numeric(14,3);
  v_sales_total numeric(14,2);
  v_returns_total numeric(14,2);
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;

  select id into v_ar_acc_id from public.accounts where code = '1200';
  select id into v_ret_acc_id from public.accounts where code = '4110';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inv_acc_id from public.accounts where code = '1310';
  select id into v_cogs_acc_id from public.accounts where code = '5100';
  if v_ar_acc_id is null or v_ret_acc_id is null or v_inventory_acc_id is null or v_rm_inv_acc_id is null or v_cogs_acc_id is null then
    raise exception 'COA Codes missing (1200, 4110, 1300, 1310, 5100)';
  end if;

  select * into v_ret from public.sales_returns where id = p_return_id for update;
  if v_ret.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_ret.return_date) then raise exception 'Periode CLOSED'; end if;

  select * into v_sales from public.sales where id = v_ret.sales_id;
  if v_sales.status <> 'POSTED' then raise exception 'Sales must be POSTED'; end if;

  v_method := upper(coalesce(v_sales.payment_method_code, 'CASH'));
  v_cash_acc_id := public.get_payment_account_for_method(v_method);

  -- Recompute subtotals
  update public.sales_return_items
  set subtotal = round(qty * unit_price, 2)
  where sales_return_id = p_return_id;

  select coalesce(sum(qty * unit_price),0) into v_total
  from public.sales_return_items
  where sales_return_id = p_return_id;
  if v_total <= 0 then raise exception 'Total must be > 0'; end if;

  -- Validate return qty per item (cannot exceed sold - already returned)
  for v_line in
    select item_id, qty from public.sales_return_items where sales_return_id = p_return_id
  loop
    select coalesce(sum(qty),0) into v_sold_qty
    from public.sales_items
    where sales_id = v_ret.sales_id and item_id = v_line.item_id;

    if v_sold_qty = 0 then
      raise exception 'Item not found in original sales';
    end if;

    select coalesce(sum(ri.qty),0) into v_returned_qty
    from public.sales_return_items ri
    join public.sales_returns r on r.id = ri.sales_return_id
    where r.sales_id = v_ret.sales_id
      and r.status = 'POSTED'
      and ri.item_id = v_line.item_id
      and r.id <> p_return_id;

    v_remaining_qty := v_sold_qty - v_returned_qty;
    if v_line.qty > v_remaining_qty then
      raise exception 'Return qty exceeds remaining sold qty';
    end if;
  end loop;

  -- Guard return total not exceeding sales total minus posted returns
  v_sales_total := coalesce(v_sales.total_amount, 0);
  select coalesce(sum(total_amount),0) into v_returns_total
  from public.sales_returns
  where sales_id = v_ret.sales_id
    and status = 'POSTED'
    and id <> p_return_id;

  if v_total > (v_sales_total - v_returns_total) then
    raise exception 'Return total exceeds remaining sales amount';
  end if;

  -- Cost basis (weighted avg from original sales items) + optional snapshot override
  select
    coalesce(sum(ri.qty * coalesce(nullif(ri.cost_snapshot, 0), sc.avg_cost, i.default_price_buy)), 0)::numeric(14,2),
    coalesce(sum(ri.qty * coalesce(nullif(ri.cost_snapshot, 0), sc.avg_cost, i.default_price_buy)) filter (where i.type in ('FINISHED_GOOD','TRADED')), 0)::numeric(14,2),
    coalesce(sum(ri.qty * coalesce(nullif(ri.cost_snapshot, 0), sc.avg_cost, i.default_price_buy)) filter (where i.type = 'RAW_MATERIAL'), 0)::numeric(14,2)
  into v_total_cogs, v_total_cogs_fg, v_total_cogs_rm
  from public.sales_return_items ri
  join public.items i on i.id = ri.item_id
  left join (
    select item_id,
           case when sum(qty) > 0 then sum(qty * coalesce(avg_cost_snapshot,0)) / sum(qty) else 0 end as avg_cost
    from public.sales_items
    where sales_id = v_ret.sales_id
    group by item_id
  ) sc on sc.item_id = ri.item_id
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

-- ------------------------------------------------------------
-- rpc_post_purchase_return
-- ------------------------------------------------------------
create or replace function public.rpc_post_purchase_return(p_return_id uuid, p_method text default 'CASH')
returns jsonb language plpgsql security definer as $$
declare
  v_ret record; v_pur record; v_ap record; v_total numeric(14,2); v_journal_id uuid; v_line record;
  v_pay_acc uuid; v_inv_acc uuid; v_rm_acc uuid; v_ap_acc uuid;
  v_reduce_ap numeric(14,2) := 0; v_refund_cash numeric(14,2) := 0;
  v_tot_inv_fg numeric(14,2); v_tot_inv_rm numeric(14,2);
  v_method text;
  v_bought_qty numeric(14,3);
  v_returned_qty numeric(14,3);
  v_remaining_qty numeric(14,3);
  v_pur_total numeric(14,2);
  v_returns_total numeric(14,2);
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select id into v_inv_acc from public.accounts where code = '1300';
  select id into v_rm_acc from public.accounts where code = '1310';
  select id into v_ap_acc from public.accounts where code = '2100';
  if v_inv_acc is null or v_rm_acc is null or v_ap_acc is null then
    raise exception 'COA Codes missing (1300, 1310, 2100)';
  end if;

  select * into v_ret from public.purchase_returns where id = p_return_id for update;
  if v_ret.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_ret.return_date) then raise exception 'Periode CLOSED'; end if;

  select * into v_pur from public.purchases where id = v_ret.purchase_id;
  if v_pur.status <> 'POSTED' then raise exception 'Purchase must be POSTED'; end if;

  -- Recompute subtotals
  update public.purchase_return_items
  set subtotal = round(qty * unit_cost, 2)
  where purchase_return_id = p_return_id;

  -- Validate return qty per item
  for v_line in
    select item_id, qty from public.purchase_return_items where purchase_return_id = p_return_id
  loop
    select coalesce(sum(qty),0) into v_bought_qty
    from public.purchase_items
    where purchase_id = v_ret.purchase_id and item_id = v_line.item_id;

    if v_bought_qty = 0 then
      raise exception 'Item not found in original purchase';
    end if;

    select coalesce(sum(ri.qty),0) into v_returned_qty
    from public.purchase_return_items ri
    join public.purchase_returns r on r.id = ri.purchase_return_id
    where r.purchase_id = v_ret.purchase_id
      and r.status = 'POSTED'
      and ri.item_id = v_line.item_id
      and r.id <> p_return_id;

    v_remaining_qty := v_bought_qty - v_returned_qty;
    if v_line.qty > v_remaining_qty then
      raise exception 'Return qty exceeds remaining purchased qty';
    end if;
  end loop;

  v_method := upper(coalesce(nullif(trim(p_method), ''), v_pur.payment_method_code, 'CASH'));
  v_pay_acc := public.get_payment_account_for_method(v_method);

  select coalesce(sum(pr.qty * pr.unit_cost), 0),
         coalesce(sum(pr.qty * pr.unit_cost) filter (where i.type in ('FINISHED_GOOD','TRADED')), 0),
         coalesce(sum(pr.qty * pr.unit_cost) filter (where i.type='RAW_MATERIAL'), 0)
  into v_total, v_tot_inv_fg, v_tot_inv_rm
  from public.purchase_return_items pr
  join public.items i on i.id = pr.item_id
  where pr.purchase_return_id = p_return_id;

  if v_total <= 0 then raise exception 'Total > 0 required'; end if;

  -- Guard return total not exceeding purchase total minus posted returns
  v_pur_total := coalesce(v_pur.total_amount, 0);
  select coalesce(sum(total_amount),0) into v_returns_total
  from public.purchase_returns
  where purchase_id = v_ret.purchase_id
    and status = 'POSTED'
    and id <> p_return_id;

  if v_total > (v_pur_total - v_returns_total) then
    raise exception 'Return total exceeds remaining purchase amount';
  end if;

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

-- ------------------------------------------------------------
-- rpc_adjust_stock
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- rpc_set_opening_stock
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- import_master_data
-- ------------------------------------------------------------
create or replace function public.import_master_data(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    row_data jsonb;
    v_uom_id uuid;
    v_size_id uuid;
    v_color_id uuid;

    -- Names
    v_brand_name text;
    v_category_name text;
    v_uom_name text;
    v_size_name text;
    v_color_name text;

    v_item_sku text;
    v_item_name text;
    v_item_type text;

    v_price_default numeric;
    v_price_khusus numeric;
    v_def_price_buy numeric;
    v_min_stock numeric;
    v_initial_stock numeric;

    -- Stats
    v_processed_count int := 0;
    v_inserted_count int := 0;
    v_updated_count int := 0;
    v_skipped_count int := 0;
    v_item_id uuid;
    v_existing_item_id uuid;
begin
    if not (public.is_admin() or public.is_owner()) then
        raise exception 'Auth failed';
    end if;

    for row_data in select * from jsonb_array_elements(data)
    loop
        v_processed_count := v_processed_count + 1;

        v_item_sku := btrim(coalesce(row_data->>'sku', ''));
        v_item_name := btrim(coalesce(row_data->>'name', ''));

        if v_item_sku = '' or v_item_name = '' then
            continue;
        end if;

        -- Skip full row if SKU already exists (case-insensitive)
        select id into v_existing_item_id
        from public.items
        where lower(sku) = lower(v_item_sku)
        limit 1;
        if v_existing_item_id is not null then
            v_skipped_count := v_skipped_count + 1;
            continue;
        end if;

        -- BRAND (Optional) - case-insensitive
        v_brand_name := btrim(coalesce(row_data->>'brand_name', ''));
        if v_brand_name <> '' then
            if not exists (select 1 from public.brands where lower(name) = lower(v_brand_name)) then
                insert into brands (name, is_active)
                values (v_brand_name, true)
                on conflict (name) do update set updated_at = now();
            end if;
        end if;

        -- CATEGORY (Optional) - case-insensitive
        v_category_name := btrim(coalesce(row_data->>'category_name', ''));
        if v_category_name <> '' then
            if not exists (select 1 from public.categories where lower(name) = lower(v_category_name)) then
                insert into categories (name, is_active)
                values (v_category_name, true)
                on conflict (name) do update set updated_at = now();
            end if;
        end if;

        -- UoM
        v_uom_name := btrim(coalesce(row_data->>'uom_name', 'PCS'));
        if v_uom_name = '' then v_uom_name := 'PCS'; end if;

        select id into v_uom_id
        from uoms
        where code = upper(slugify(v_uom_name))
           or lower(name) = lower(v_uom_name)
        limit 1;
        if v_uom_id is null then
            insert into uoms (code, name, is_active)
            values (upper(slugify(v_uom_name)), v_uom_name, true)
            on conflict (code) do update set updated_at = now()
            returning id into v_uom_id;
        end if;

        -- Size
        v_size_name := btrim(coalesce(row_data->>'size_name', ''));
        v_size_id := null;
        if v_size_name <> '' then
            select id into v_size_id
            from sizes
            where code = upper(slugify(v_size_name))
               or lower(name) = lower(v_size_name)
            limit 1;
            if v_size_id is null then
                insert into sizes (code, name, is_active)
                values (upper(slugify(v_size_name)), v_size_name, true)
                on conflict (code) do update set updated_at = now()
                returning id into v_size_id;
            end if;
        end if;

        -- Color
        v_color_name := btrim(coalesce(row_data->>'color_name', ''));
        v_color_id := null;
        if v_color_name <> '' then
            select id into v_color_id
            from colors
            where code = upper(slugify(v_color_name))
               or lower(name) = lower(v_color_name)
            limit 1;
            if v_color_id is null then
                insert into colors (code, name, is_active)
                values (upper(slugify(v_color_name)), v_color_name, true)
                on conflict (code) do update set updated_at = now()
                returning id into v_color_id;
            end if;
        end if;

        -- INSERT ITEM (no update on conflict due to skip above)
        v_item_type := coalesce(row_data->>'type', 'FINISHED_GOOD');
        if v_item_type not in ('FINISHED_GOOD','RAW_MATERIAL','TRADED') then
            v_item_type := 'FINISHED_GOOD';
        end if;
        v_price_default := coalesce(
            (row_data->>'price_default')::numeric,
            (row_data->>'price_umum')::numeric,
            0
        );
        v_price_khusus := coalesce((row_data->>'price_khusus')::numeric, 0);
        v_def_price_buy := coalesce((row_data->>'purchase_price')::numeric, 0);
        v_min_stock := coalesce((row_data->>'min_stock')::numeric, 0);
        v_initial_stock := coalesce((row_data->>'initial_stock')::numeric, 0);

        insert into items (
            sku, name, type,
            uom_id, size_id, color_id,
            price_default, price_khusus, default_price_buy, min_stock,
            is_active
        )
        values (
            v_item_sku, v_item_name, v_item_type::item_type,
            v_uom_id, v_size_id, v_color_id,
            v_price_default, v_price_khusus, v_def_price_buy, v_min_stock,
            true
        )
        returning id into v_item_id;

        v_inserted_count := v_inserted_count + 1;

        -- OPENING STOCK (only once)
        if v_initial_stock > 0 then
            if not exists (
                select 1 from public.inventory_adjustments
                where item_id = v_item_id
                  and (reason = 'Opening Stock' or reason ilike 'opening%' or reason ilike '%import initial stock%')
            ) then
                insert into public.inventory_adjustments (item_id, qty_delta, reason, adjusted_at)
                values (v_item_id, v_initial_stock, 'Opening Stock', now());

                insert into public.inventory_stock (item_id, qty_on_hand, avg_cost, updated_at)
                values (v_item_id, v_initial_stock, v_def_price_buy, now())
                on conflict (item_id) do update
                set
                    avg_cost = case
                        when inventory_stock.qty_on_hand + excluded.qty_on_hand = 0 then excluded.avg_cost
                        when inventory_stock.qty_on_hand = 0 then excluded.avg_cost
                        else (inventory_stock.qty_on_hand * inventory_stock.avg_cost + excluded.qty_on_hand * excluded.avg_cost)
                            / (inventory_stock.qty_on_hand + excluded.qty_on_hand)
                    end,
                    qty_on_hand = inventory_stock.qty_on_hand + excluded.qty_on_hand,
                    updated_at = now();
            end if;
        end if;

    end loop;

    return jsonb_build_object(
        'success', true,
        'processed', v_processed_count,
        'inserted_or_updated', v_inserted_count + v_updated_count,
        'skipped', v_skipped_count
    );
end;
$$;
