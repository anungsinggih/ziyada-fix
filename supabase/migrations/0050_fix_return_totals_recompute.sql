-- ============================================================
-- 0050_fix_return_totals_recompute.sql
-- Recompute return subtotals server-side on posting
-- ============================================================

-- SALES RETURN: recompute subtotal from qty * unit_price
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
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;

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

-- PURCHASE RETURN: recompute subtotal from qty * unit_cost
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
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select id into v_inv_acc from public.accounts where code = '1300';
  select id into v_rm_acc from public.accounts where code = '1310';
  select id into v_ap_acc from public.accounts where code = '2100';

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
