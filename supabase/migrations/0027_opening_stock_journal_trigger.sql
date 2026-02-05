-- ============================================================
-- 0027_opening_stock_journal_trigger.sql
-- Auto-create journal for Opening Stock adjustments
-- ============================================================

create or replace function public.trg_create_opening_stock_journal()
returns trigger language plpgsql security definer as $$
declare
  v_inv_acc uuid;
  v_open_acc uuid;
  v_cost numeric;
  v_amount numeric;
  v_journal_id uuid;
begin
  if NEW.reason is null then
    return NEW;
  end if;

  if NEW.reason ilike 'opening%' then
    if exists (
      select 1 from public.journals
      where ref_type = 'opening_stock'
        and ref_id = NEW.id
    ) then
      return NEW;
    end if;

    select id into v_inv_acc from public.accounts where code = '1300';
    select id into v_open_acc from public.accounts where code = '3200';
    select default_price_buy into v_cost from public.items where id = NEW.item_id;
    v_amount := abs(NEW.qty_delta) * coalesce(v_cost, 0);

    if v_amount > 0 and v_inv_acc is not null and v_open_acc is not null then
      v_journal_id := public.create_journal(coalesce(NEW.adjusted_at::date, current_date), 'opening_stock', NEW.id, 'Opening Stock');
      if NEW.qty_delta > 0 then
        perform public.add_journal_line(v_journal_id, v_inv_acc, v_amount, 0, 'Opening Stock');
        perform public.add_journal_line(v_journal_id, v_open_acc, 0, v_amount, 'Modal Awal');
      else
        perform public.add_journal_line(v_journal_id, v_open_acc, v_amount, 0, 'Modal Awal');
        perform public.add_journal_line(v_journal_id, v_inv_acc, 0, v_amount, 'Opening Stock');
      end if;
    end if;
  end if;

  return NEW;
end $$;

drop trigger if exists trg_opening_stock_journal on public.inventory_adjustments;
create trigger trg_opening_stock_journal
after insert on public.inventory_adjustments
for each row execute function public.trg_create_opening_stock_journal();

-- Update rpc_set_opening_stock to avoid double journal creation
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
