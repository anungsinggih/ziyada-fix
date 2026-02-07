-- ============================================================
-- 0094_allow_zero_cost_adjustment.sql
-- Allow stock adjustment when cost is zero (skip journal)
-- ============================================================

create or replace function public.rpc_adjust_stock(p_item_id uuid, p_qty_delta numeric, p_reason text)
returns jsonb language plpgsql security definer as $$
declare
  v_journal_id uuid; v_adj_id uuid; v_inv_acc uuid; v_exp_acc uuid;
  v_cost numeric; v_journal_amount numeric; v_on_hand numeric(14,3);
  v_skip_journal boolean := false;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  if p_qty_delta is null or abs(p_qty_delta) < 0.0001 then
    raise exception 'Qty delta must not be zero';
  end if;
  if public.is_date_in_closed_period(current_date) then raise exception 'Periode CLOSED'; end if;
  select id into v_inv_acc from public.accounts where code = '1300';
  select id into v_exp_acc from public.accounts where code = '6100';
  if v_inv_acc is null or v_exp_acc is null then
    raise exception 'COA Codes missing (1300, 6100)';
  end if;
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

  v_journal_amount := abs(p_qty_delta) * coalesce(v_cost, 0);
  if v_journal_amount <= 0 then
    v_skip_journal := true;
  end if;

  insert into public.inventory_adjustments(item_id, qty_delta, reason, adjusted_at)
  values (p_item_id, p_qty_delta, p_reason, now())
  returning id into v_adj_id;

  perform public.apply_stock_delta(p_item_id, p_qty_delta);
  
  if not v_skip_journal then
    v_journal_id := public.create_journal(current_date, 'adjustment', v_adj_id, 'Adj: ' || coalesce(p_reason, ''));
    if p_qty_delta > 0 then
      perform public.add_journal_line(v_journal_id, v_inv_acc, v_journal_amount, 0, 'Stock Gain');
      perform public.add_journal_line(v_journal_id, v_exp_acc, 0, v_journal_amount, 'Adj Gain');
    else
      perform public.add_journal_line(v_journal_id, v_exp_acc, v_journal_amount, 0, 'Adj Loss');
      perform public.add_journal_line(v_journal_id, v_inv_acc, 0, v_journal_amount, 'Stock Loss');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_adj_id, 'journal_id', v_journal_id, 'journal_skipped', v_skip_journal);
end $$;

