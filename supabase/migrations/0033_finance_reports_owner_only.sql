-- ============================================================
-- 0033_finance_reports_owner_only.sql
-- Restrict finance reporting RPCs to OWNER only
-- ============================================================

create or replace function public.rpc_get_account_balances(p_start_date date, p_end_date date)
returns setof report_account_balance language plpgsql security definer as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
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

create or replace function public.rpc_get_gl(p_account_id uuid, p_start_date date, p_end_date date)
returns table (journal_date date, ref_type text, ref_no text, memo text, debit numeric, credit numeric, trx_id uuid)
language plpgsql security definer as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
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

create or replace function public.rpc_get_cashflow(p_start_date date, p_end_date date)
returns table (category text, description text, amount numeric(14,2))
language plpgsql security definer as $$
declare
  v_cash_account_id uuid; v_opening_cash numeric(14,2); v_receipts_total numeric(14,2); v_payments_total numeric(14,2); v_closing_cash numeric(14,2);
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
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
  select * from (
    values
      ('OPENING'::text, 'Opening Cash'::text, v_opening_cash),
      ('RECEIPTS'::text, 'Total Receipts'::text, v_receipts_total),
      ('PAYMENTS'::text, 'Total Payments'::text, -v_payments_total),
      ('CLOSING'::text, 'Closing Cash'::text, v_closing_cash)
  ) t;
end $$;
