-- ============================================================
-- 0075_guard_return_method.sql
-- Require valid payment method on CASH returns
-- ============================================================

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
  if v_sales.terms = 'CASH' and (v_sales.payment_method_code is null or btrim(v_sales.payment_method_code) = '') then
    raise exception 'Payment method is required for CASH terms';
  end if;

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
    if v_total_cogs_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_inv_acc_id, 0, v_total_cogs_rm, 'Inventory recovery (RM)'); end if;
    perform public.add_journal_line(v_journal_id, v_cogs_acc_id, 0, v_total_cogs, 'COGS reduction');
  end if;

  return jsonb_build_object('ok', true, 'return_id', p_return_id, 'journal_id', v_journal_id);
end $$;
