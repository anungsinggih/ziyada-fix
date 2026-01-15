-- ============================================================
-- 0005_phase1_consolidated_reporting.sql
-- PHASE 1 REPORTING, DASHBOARD & PERIOD MGMT (Consolidated)
-- Merges: 010 (View), 011 (View Update), 012 (Reports), 017 (Period/Opening), 018 (Cashflow), 021 (Dashboard)
-- ============================================================

set search_path = public;

-- ============================================================
-- 1. VIEWS (Stock Card)
-- ============================================================
create or replace view public.view_stock_card as
select
  i.id as item_id,
  i.sku,
  i.name as item_name,
  t.trx_date,
  t.trx_type,
  t.ref_no,
  t.qty_change,
  t.uom,
  t.created_at
from public.items i
cross join lateral (
  -- Sales (Decrease)
  select
    s.sales_date as trx_date,
    'SALES' as trx_type,
    s.sales_no as ref_no,
    (si.qty * -1) as qty_change,
    si.uom_snapshot as uom,
    s.created_at
  from public.sales_items si
  join public.sales s on s.id = si.sales_id
  where si.item_id = i.id and s.status = 'POSTED'

  union all

  -- Purchases (Increase)
  select
    p.purchase_date as trx_date,
    'PURCHASE' as trx_type,
    p.purchase_no as ref_no,
    pi.qty as qty_change,
    pi.uom_snapshot as uom,
    p.created_at
  from public.purchase_items pi
  join public.purchases p on p.id = pi.purchase_id
  where pi.item_id = i.id and p.status = 'POSTED'

  union all

  -- Sales Returns (Increase)
  select
    r.return_date as trx_date,
    'RETURN_SALES' as trx_type,
    s.sales_no || '-RET' as ref_no, -- or r.return_no
    ri.qty as qty_change,
    ri.uom_snapshot as uom,
    r.created_at
  from public.sales_return_items ri
  join public.sales_returns r on r.id = ri.sales_return_id
  join public.sales s on s.id = r.sales_id
  where ri.item_id = i.id and r.status = 'POSTED'

  union all
  
  -- Purchase Returns (Decrease)
  select
    pr.return_date as trx_date,
    'RETURN_PURCHASE' as trx_type,
    p.purchase_no || '-RET' as ref_no, -- or pr.return_no
    (pri.qty * -1) as qty_change,
    pri.uom_snapshot as uom,
    pr.created_at
  from public.purchase_return_items pri
  join public.purchase_returns pr on pr.id = pri.purchase_return_id
  join public.purchases p on p.id = pr.purchase_id
  where pri.item_id = i.id and pr.status = 'POSTED'

  union all

  -- Adjustments (Delta)
  select
    a.adjusted_at::date as trx_date,
    'ADJUSTMENT' as trx_type,
    a.reason as ref_no,
    a.qty_delta as qty_change,
    i.uom as uom,
    a.adjusted_at as created_at
  from public.inventory_adjustments a
  where a.item_id = i.id
) t;


-- ============================================================
-- 2. FINANCIAL REPORTS (012, 018)
-- ============================================================

-- Type for Balance Report
do $$ begin create type report_account_balance as (
  account_id uuid,
  code text,
  name text,
  account_type text,
  opening_balance numeric,
  debit_movement numeric,
  credit_movement numeric,
  closing_balance numeric
); exception when duplicate_object then null; end $$;

-- RPC Get Account Balances
create or replace function public.rpc_get_account_balances(p_start_date date, p_end_date date)
returns setof report_account_balance language plpgsql security definer as $$
begin
  return query
  with 
  opening as (
    select account_id, sum(debit - credit) as net_val
    from (
      select account_id, debit, credit from public.journal_lines jl join public.journals j on j.id = jl.journal_id where j.journal_date < p_start_date
      union all
      select account_id, debit, credit from public.opening_balances where as_of_date < p_start_date
    ) o group by account_id
  ),
  movements as (
     select jl.account_id, sum(jl.debit) as dry, sum(jl.credit) as cry
     from public.journal_lines jl join public.journals j on j.id = jl.journal_id
     where j.journal_date between p_start_date and p_end_date
     group by jl.account_id
  ),
  movements_ob as (
      select account_id, debit, credit from public.opening_balances
      where as_of_date between p_start_date and p_end_date
  ),
  combined_movements as (
     select account_id, sum(debit) as dry, sum(credit) as cry
     from (select account_id, dry as debit, cry as credit from movements union all select account_id, debit, credit from movements_ob) m
     group by account_id
  )
  select a.id, a.code, a.name, 'UNKNOWN'::text, coalesce(op.net_val, 0), coalesce(mv.dry, 0), coalesce(mv.cry, 0), (coalesce(op.net_val, 0) + coalesce(mv.dry, 0) - coalesce(mv.cry, 0))
  from public.accounts a
  left join opening op on op.account_id = a.id
  left join combined_movements mv on mv.account_id = a.id
  order by a.code;
end $$;

-- RPC Get GL
create or replace function public.rpc_get_gl(p_account_id uuid, p_start_date date, p_end_date date)
returns table (journal_date date, ref_type text, ref_no text, memo text, debit numeric, credit numeric, trx_id uuid)
language plpgsql security definer as $$
begin
  return query
  select j.journal_date, j.ref_type, j.memo as ref_no, jl.line_memo as memo, jl.debit, jl.credit, j.id
  from public.journal_lines jl join public.journals j on j.id = jl.journal_id
  where jl.account_id = p_account_id and j.journal_date between p_start_date and p_end_date
  union all
  select ob.as_of_date, 'OPENING_BALANCE', 'Opening Balance', 'Initial Balance', ob.debit, ob.credit, null
  from public.opening_balances ob
  where ob.account_id = p_account_id and ob.as_of_date between p_start_date and p_end_date
  order by 1, 7;
end $$;

-- RPC Get Cashflow (018)
create or replace function public.rpc_get_cashflow(p_start_date date, p_end_date date)
returns table (category text, description text, amount numeric(14,2))
language plpgsql security definer as $$
declare
  v_cash_account_id uuid; v_opening_cash numeric(14,2); v_receipts_total numeric(14,2); v_payments_total numeric(14,2); v_closing_cash numeric(14,2);
begin
  select id into v_cash_account_id from public.accounts where code = '1100';
  if v_cash_account_id is null then raise exception 'Cash account 1100 missing'; end if;

  select coalesce(sum(case when jl.debit > 0 then jl.debit else -jl.credit end), 0) into v_opening_cash
  from public.journal_lines jl join public.journals j on j.id = jl.journal_id
  where jl.account_id = v_cash_account_id and j.journal_date < p_start_date;

  select coalesce(sum(debit), 0) into v_receipts_total
  from public.journal_lines jl join public.journals j on j.id = jl.journal_id
  where jl.account_id = v_cash_account_id and j.journal_date between p_start_date and p_end_date and jl.debit > 0;

  select coalesce(sum(credit), 0) into v_payments_total
  from public.journal_lines jl join public.journals j on j.id = jl.journal_id
  where jl.account_id = v_cash_account_id and j.journal_date between p_start_date and p_end_date and jl.credit > 0;

  v_closing_cash := v_opening_cash + v_receipts_total - v_payments_total;

  return query
  select 'Opening'::text, 'Cash at beginning'::text, v_opening_cash
  union all
  select 'Inflow'::text, 'Total cash receipts'::text, v_receipts_total
  union all
  select 'Outflow'::text, 'Total cash payments'::text, -v_payments_total
  union all
  select 'Closing'::text, 'Cash at end'::text, v_closing_cash;
end $$;


-- ============================================================
-- 3. DASHBOARD METRICS (021)
-- ============================================================
create or replace function public.rpc_get_dashboard_metrics()
returns jsonb language plpgsql security definer as $$
declare
  v_sales_today numeric; v_sales_month numeric; v_sales_count_today int;
  v_purchases_month numeric; v_purchases_count_month int; v_low_stock_count int; v_total_items int;
  v_recent_sales jsonb; v_recent_purchases jsonb;
begin
  select coalesce(sum(total_amount), 0), count(*) into v_sales_today, v_sales_count_today from public.sales where sales_date = current_date and status = 'POSTED';
  select coalesce(sum(total_amount), 0) into v_sales_month from public.sales where date_trunc('month', sales_date) = date_trunc('month', current_date) and status = 'POSTED';
  select coalesce(sum(total_amount), 0), count(*) into v_purchases_month, v_purchases_count_month from public.purchases where date_trunc('month', purchase_date) = date_trunc('month', current_date) and status = 'POSTED';
  select count(*) into v_total_items from public.items where is_active = true;
  select count(*) into v_low_stock_count from public.inventory_stock s join public.items i on s.item_id = i.id where i.is_active = true and s.qty_on_hand <= 5;

  select jsonb_agg(t) into v_recent_sales from (
    select s.id, s.sales_no, s.sales_date, c.name as customer_name, s.total_amount, s.status
    from public.sales s left join public.customers c on s.customer_id = c.id order by s.created_at desc limit 5
  ) t;

  select jsonb_agg(t) into v_recent_purchases from (
    select p.id, p.purchase_no, p.purchase_date, v.name as vendor_name, p.total_amount, p.status
    from public.purchases p left join public.vendors v on p.vendor_id = v.id order by p.created_at desc limit 5
  ) t;

  return jsonb_build_object(
    'sales_today', v_sales_today,
    'sales_month', v_sales_month,
    'sales_count_today', v_sales_count_today,
    'purchases_month', v_purchases_month,
    'purchases_count_month', v_purchases_count_month,
    'low_stock_count', v_low_stock_count,
    'total_items', v_total_items,
    'recent_sales', coalesce(v_recent_sales, '[]'::jsonb),
    'recent_purchases', coalesce(v_recent_purchases, '[]'::jsonb)
  );
end $$;


-- ============================================================
-- 4. PERIOD & OPENING MANAGEMENT (017)
-- ============================================================

-- Create Period (Owner)
create or replace function public.rpc_create_period(p_name text, p_start_date date, p_end_date date)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_end_date < p_start_date then raise exception 'End date < Start date'; end if;
  if exists (select 1 from public.accounting_periods where daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')) then raise exception 'Overlap'; end if;
  insert into public.accounting_periods(name, start_date, end_date, status) values (p_name, p_start_date, p_end_date, 'OPEN') returning id into v_id;
  return v_id;
end $$;

-- Set Period Status
create or replace function public.rpc_set_period_status(p_period_id uuid, p_status period_status)
returns jsonb language plpgsql security definer as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  update public.accounting_periods set status = p_status, closed_at = case when p_status='CLOSED' then now() else null end, closed_by = case when p_status='CLOSED' then auth.uid() else null end where id = p_period_id;
  return jsonb_build_object('ok', true);
end $$;

-- Export Report Log
create or replace function public.rpc_export_period_reports(p_period_id uuid, p_report_type text, p_notes text default null)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  insert into public.period_exports(period_id, report_type, notes, exported_by) values (p_period_id, p_report_type, coalesce(p_notes,'Manual'), auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- Set Opening Balance
create or replace function public.rpc_set_opening_balance(p_as_of_date date, p_lines jsonb)
returns jsonb language plpgsql security definer as $$
declare v_line jsonb; v_acc_id uuid; v_d numeric; v_c numeric; v_tot_d numeric := 0; v_tot_c numeric := 0;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if public.is_date_in_closed_period(p_as_of_date) then raise exception 'Periode CLOSED'; end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_d := coalesce((v_line->>'debit')::numeric,0); v_c := coalesce((v_line->>'credit')::numeric,0);
    v_tot_d := v_tot_d + v_d; v_tot_c := v_tot_c + v_c;
  end loop;
  if abs(v_tot_d - v_tot_c) > 0.005 then raise exception 'Unbalanced OB'; end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_acc_id := (v_line->>'account_id')::uuid; v_d := coalesce((v_line->>'debit')::numeric,0); v_c := coalesce((v_line->>'credit')::numeric,0);
    insert into public.opening_balances(as_of_date, account_id, debit, credit, created_by) values (p_as_of_date, v_acc_id, v_d, v_c, auth.uid())
    on conflict (as_of_date, account_id) do update set debit=excluded.debit, credit=excluded.credit;
  end loop;
  return jsonb_build_object('ok', true);
end $$;
