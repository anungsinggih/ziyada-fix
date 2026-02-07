-- ============================================================
-- 0095_fix_sales_draft_update_rpc_unused_var.sql
-- Remove unused variable warning in rpc_update_sales_draft_items
-- ============================================================

create or replace function public.rpc_update_sales_draft_items(
  p_sales_id uuid,
  p_items jsonb
)
returns jsonb language plpgsql security definer as $$
declare
  v_sale record;
begin
  -- 1. Auth Check
  if not (public.is_admin() or public.is_owner()) then 
    raise exception 'Auth failed: Admin or Owner required'; 
  end if;

  -- 2. Validate Sales Header
  select * into v_sale from public.sales where id = p_sales_id for update;
  if not found then raise exception 'Sales not found'; end if;
  if v_sale.status <> 'DRAFT' then raise exception 'Sales must be DRAFT to update items'; end if;
  if public.is_date_in_closed_period(v_sale.sales_date) then raise exception 'Periode CLOSED'; end if;

  -- 3. Delete Existing Items
  delete from public.sales_items where sales_id = p_sales_id;

  -- 4. Insert New Items
  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_items (sales_id, item_id, qty, unit_price, subtotal, uom_snapshot)
    select 
      p_sales_id,
      (item->>'item_id')::uuid,
      (item->>'qty')::numeric,
      (item->>'unit_price')::numeric,
      (item->>'subtotal')::numeric,
      (item->>'uom_snapshot')::text
    from jsonb_array_elements(p_items) as item;
  end if;

  -- 5. Return success
  return jsonb_build_object('ok', true);
end $$;
