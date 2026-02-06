-- ============================================================
-- 0048_fix_adjust_stock_zero.sql
-- Prevent zero-qty adjustments (avoid empty journal/entries)
-- ============================================================

create or replace function public.rpc_adjust_stock(p_item_id uuid, p_qty_delta numeric, p_reason text)
returns jsonb language plpgsql security definer as $$
declare
  v_journal_id uuid; v_adj_id uuid; v_inv_acc uuid; v_exp_acc uuid;
  v_cost numeric; v_journal_amount numeric;
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
