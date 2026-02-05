-- ============================================================
-- 0043_guard_generate_tx_doc_no.sql
-- Prevent non-admin/owner from consuming doc sequences
-- ============================================================

create or replace function public.generate_tx_doc_no(p_prefix text, p_ts timestamptz default now())
returns text language plpgsql volatile as $$
declare
  v_period text := to_char((p_ts AT TIME ZONE 'Asia/Jakarta'), 'YYYYMMDD');
  v_ts text := to_char((p_ts AT TIME ZONE 'Asia/Jakarta'), 'YYYYMMDDHH24MI');
  v_seq int;
begin
  if not (public.is_admin() or public.is_owner()) then
    raise exception 'Auth failed';
  end if;
  insert into public.tx_doc_sequences(prefix, period, last_seq) values (p_prefix, v_period, 1)
  on conflict (prefix, period) do update set last_seq = public.tx_doc_sequences.last_seq + 1 returning public.tx_doc_sequences.last_seq into v_seq;
  return format('%s-%s%04s', upper(p_prefix), v_ts, lpad(v_seq::text, 4, '0'));
end $$;
