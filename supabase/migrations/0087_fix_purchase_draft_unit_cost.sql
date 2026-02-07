-- ============================================================
-- 0087_fix_purchase_draft_unit_cost.sql
-- Use unit_cost column for purchase draft updates
-- ============================================================

create or replace function public.rpc_update_purchase_draft_items(
  p_purchase_id uuid,
  p_items jsonb
)
returns jsonb language plpgsql security definer as $$
declare
  v_pur record;
begin
  if not (public.is_admin() or public.is_owner()) then 
    raise exception 'Auth failed: Admin or Owner required'; 
  end if;

  select * into v_pur from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_pur.status <> 'DRAFT' then raise exception 'Purchase must be DRAFT to update items'; end if;
  if public.is_date_in_closed_period(v_pur.purchase_date) then raise exception 'Periode CLOSED'; end if;

  delete from public.purchase_items where purchase_id = p_purchase_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_items (purchase_id, item_id, qty, unit_cost, subtotal, uom_snapshot)
    select 
      p_purchase_id,
      (item->>'item_id')::uuid,
      (item->>'qty')::numeric,
      coalesce((item->>'unit_cost')::numeric, (item->>'unit_price')::numeric),
      (item->>'subtotal')::numeric,
      (item->>'uom_snapshot')::text
    from jsonb_array_elements(p_items) as item;
  end if;

  return jsonb_build_object('ok', true);
end $$;
