-- ============================================================
-- 0072_guard_purchase_return_stock.sql
-- Prevent purchase returns from exceeding on-hand stock
-- ============================================================

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
  v_on_hand numeric(14,3);
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

    -- Guard on-hand stock to avoid negative inventory
    perform public.ensure_stock_row(v_line.item_id);
    select qty_on_hand into v_on_hand from public.inventory_stock where item_id = v_line.item_id for update;
    if coalesce(v_on_hand, 0) < v_line.qty then
      raise exception 'Insufficient stock for return';
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
