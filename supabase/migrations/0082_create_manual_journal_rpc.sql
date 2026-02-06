-- ============================================================
-- 0082_create_manual_journal_rpc.sql
-- Create manual journal with balanced lines
-- ============================================================

create or replace function public.rpc_create_manual_journal(
  p_journal_date date,
  p_memo text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_total_debit numeric(14,2) := 0;
  v_total_credit numeric(14,2) := 0;
  v_account_id uuid;
  v_journal_id uuid;
  v_ref_id uuid := gen_random_uuid();
  v_line_memo text;
begin
  if not public.is_owner() then
    raise exception 'Owner only';
  end if;

  if p_journal_date is null then
    raise exception 'Journal date is required';
  end if;

  if public.is_date_in_closed_period(p_journal_date) then
    raise exception 'Periode CLOSED';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Lines are required';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_account_id := (v_line->>'account_id')::uuid;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    v_line_memo := nullif(btrim(coalesce(v_line->>'memo','')), '');

    if v_account_id is null then
      raise exception 'Account is required';
    end if;
    if v_debit < 0 or v_credit < 0 then
      raise exception 'Debit/Credit must be >= 0';
    end if;
    if v_debit > 0 and v_credit > 0 then
      raise exception 'Debit/Credit cannot both be > 0';
    end if;
    if v_debit = 0 and v_credit = 0 then
      raise exception 'Line amount must be > 0';
    end if;

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if abs(v_total_debit - v_total_credit) > 0.01 then
    raise exception 'Journal not balanced';
  end if;

  v_journal_id := public.create_journal(p_journal_date, 'manual', v_ref_id, coalesce(p_memo, 'Manual Journal'));

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_account_id := (v_line->>'account_id')::uuid;
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    v_line_memo := nullif(btrim(coalesce(v_line->>'memo','')), '');

    perform public.add_journal_line(v_journal_id, v_account_id, v_debit, v_credit, v_line_memo);
  end loop;

  return jsonb_build_object('ok', true, 'journal_id', v_journal_id);
end;
$$;
