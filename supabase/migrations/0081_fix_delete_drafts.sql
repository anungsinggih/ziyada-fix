-- ============================================================
-- 0081_fix_delete_drafts.sql
-- Guard not-found and align auth for delete draft RPCs
-- ============================================================

create or replace function public.rpc_delete_sales_draft(p_sales_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_sale record;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select * into v_sale from public.sales where id = p_sales_id for update;
  if not found then raise exception 'Sales not found'; end if;
  if v_sale.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_sale.sales_date) then raise exception 'Periode CLOSED'; end if;
  delete from public.sales_items where sales_id = p_sales_id;
  delete from public.sales where id = p_sales_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rpc_delete_purchase_draft(p_purchase_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_pur record;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  select * into v_pur from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_pur.status <> 'DRAFT' then raise exception 'Must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_pur.purchase_date) then raise exception 'Periode CLOSED'; end if;
  delete from public.purchase_items where purchase_id = p_purchase_id;
  delete from public.purchases where id = p_purchase_id;
  return jsonb_build_object('ok', true);
end $$;
