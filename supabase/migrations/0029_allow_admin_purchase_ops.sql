-- ============================================================
-- 0029_allow_admin_purchase_ops.sql
-- Allow admin to handle purchase returns and delete purchase drafts
-- ============================================================

create or replace function public.rpc_post_purchase_return(p_return_id uuid, p_method text default 'CASH')
returns jsonb language plpgsql security definer as $$
declare
  v_ret record; v_pur record; v_ap record; v_total numeric(14,2); v_journal_id uuid; v_line record;
  v_pay_acc uuid; v_inv_acc uuid; v_rm_acc uuid; v_ap_acc uuid;
  v_reduce_ap numeric(14,2) := 0; v_refund_cash numeric(14,2) := 0;
  v_tot_inv_fg numeric(14,2); v_tot_inv_rm numeric(14,2);
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
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

create or replace function public.rpc_delete_purchase_draft(p_purchase_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_pur record;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select * into v_pur from public.purchases where id = p_purchase_id for update;
  if v_pur.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_pur.purchase_date) then raise exception 'Periode CLOSED'; end if;
  delete from public.purchase_items where purchase_id = p_purchase_id;
  delete from public.purchases where id = p_purchase_id;
  return jsonb_build_object('ok', true);
end $$;
