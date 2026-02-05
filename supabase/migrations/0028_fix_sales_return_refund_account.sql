-- ============================================================
-- 0028_fix_sales_return_refund_account.sql
-- Use sales payment method account for cash refunds on sales return
-- ============================================================

create or replace function public.rpc_post_sales_return(p_return_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_ret record; v_sales record; v_ar record; v_total numeric(14,2); v_journal_id uuid; v_line record;
  v_cash_acc_id uuid; v_ar_acc_id uuid; v_ret_acc_id uuid; v_inventory_acc_id uuid; v_rm_inv_acc_id uuid; v_cogs_acc_id uuid;
  v_reduce_ar numeric(14,2); v_refund_cash numeric(14,2);
  v_total_cogs numeric(14,2); v_total_cogs_fg numeric(14,2); v_total_cogs_rm numeric(14,2);
  v_method text;
begin
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
