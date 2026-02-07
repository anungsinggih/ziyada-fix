-- ============================================================
-- 0092_close_period_hpp_skip_zero.sql
-- Skip closing journal when inventory balance is zero
-- ============================================================

create or replace function public.rpc_close_period_hpp(
  p_period_id uuid,
  p_inventory_code text default '1310',
  p_cogs_code text default '5100'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_period record;
  v_inv_acc uuid;
  v_cogs_acc uuid;
  v_balance numeric;
  v_journal_id uuid;
begin
  if not public.is_owner() then
    raise exception 'Owner only';
  end if;

  select * into v_period
  from public.accounting_periods
  where id = p_period_id;
  if not found then
    raise exception 'Period not found';
  end if;

  if v_period.status <> 'OPEN' then
    raise exception 'Period must be OPEN';
  end if;

  if exists (
    select 1 from public.journals
    where ref_type = 'period_close_hpp' and ref_id = p_period_id
  ) then
    raise exception 'Closing HPP already created for this period';
  end if;

  select id into v_inv_acc from public.accounts where code = p_inventory_code;
  select id into v_cogs_acc from public.accounts where code = p_cogs_code;
  if v_inv_acc is null or v_cogs_acc is null then
    raise exception 'COA Codes missing (inventory %, cogs %)', p_inventory_code, p_cogs_code;
  end if;

  select closing_balance
    into v_balance
  from public.rpc_get_account_balances(v_period.start_date, v_period.end_date)
  where code = p_inventory_code
  limit 1;

  if v_balance is null then
    raise exception 'Inventory balance not found for account %', p_inventory_code;
  end if;

  if v_balance < 0 then
    raise exception 'Inventory balance must be >= 0 to close (current: %)', v_balance;
  end if;

  if v_balance = 0 then
    return jsonb_build_object('ok', true, 'skipped', true, 'amount', v_balance);
  end if;

  v_journal_id := public.create_journal(
    v_period.end_date,
    'period_close_hpp',
    p_period_id,
    'Closing HPP ' || v_period.name
  );

  perform public.add_journal_line(v_journal_id, v_cogs_acc, v_balance, 0, 'HPP Closing');
  perform public.add_journal_line(v_journal_id, v_inv_acc, 0, v_balance, 'Inventory Closing');

  return jsonb_build_object('ok', true, 'journal_id', v_journal_id, 'amount', v_balance);
end $$;
