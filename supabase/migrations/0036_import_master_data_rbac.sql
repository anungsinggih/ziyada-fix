-- ============================================================
-- 0036_import_master_data_rbac.sql
-- Restrict master data import to Admin/Owner
-- ============================================================

create or replace function public.import_master_data(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    row_data jsonb;
    v_brand_id uuid;
    v_category_id uuid;
    v_uom_id uuid;
    v_size_id uuid;
    v_color_id uuid;
    
    -- Names
    v_brand_name text;
    v_category_name text;
    v_uom_name text;
    v_size_name text;
    v_color_name text;
    
    v_item_sku text;
    v_item_name text;
    v_item_type text;
    
    v_price_default numeric;
    v_price_khusus numeric;
    v_def_price_buy numeric;
    v_min_stock numeric;
    v_initial_stock numeric;
    
    -- Stats
    v_processed_count int := 0;
    v_inserted_count int := 0;
    v_updated_count int := 0;
    v_skipped_count int := 0;
    v_item_id uuid;
    v_existing_item_id uuid;
begin
    if not (public.is_admin() or public.is_owner()) then
        raise exception 'Auth failed';
    end if;

    for row_data in select * from jsonb_array_elements(data)
    loop
        v_processed_count := v_processed_count + 1;
        
        v_item_sku := btrim(coalesce(row_data->>'sku', ''));
        v_item_name := btrim(coalesce(row_data->>'name', ''));
        
        if v_item_sku = '' or v_item_name = '' then
            continue;
        end if;

        -- Skip full row if SKU already exists (avoid overwriting core data)
        select id into v_existing_item_id from public.items where sku = v_item_sku limit 1;
        if v_existing_item_id is not null then
            v_skipped_count := v_skipped_count + 1;
            continue;
        end if;
        
        -- BRAND (Optional)
        v_brand_name := btrim(coalesce(row_data->>'brand_name', ''));
        v_brand_id := null;
        if v_brand_name <> '' then
            insert into brands (name, is_active)
            values (v_brand_name, true)
            on conflict (name) do update set updated_at = now()
            returning id into v_brand_id;
        end if;
        
        -- CATEGORY (Optional)
        v_category_name := btrim(coalesce(row_data->>'category_name', ''));
        v_category_id := null;
        if v_category_name <> '' then
            insert into categories (name, is_active)
            values (v_category_name, true)
            on conflict (name) do update set updated_at = now()
            returning id into v_category_id;
        end if;
        
        -- UoM
        v_uom_name := btrim(coalesce(row_data->>'uom_name', 'PCS'));
        if v_uom_name = '' then v_uom_name := 'PCS'; end if;
        
        select id into v_uom_id from uoms where code = upper(slugify(v_uom_name)) or name = v_uom_name limit 1;
        if v_uom_id is null then
            insert into uoms (code, name, is_active)
            values (upper(slugify(v_uom_name)), v_uom_name, true)
            on conflict (code) do update set updated_at = now()
            returning id into v_uom_id;
        end if;

        -- Size
        v_size_name := btrim(coalesce(row_data->>'size_name', ''));
        v_size_id := null;
        if v_size_name <> '' then
            select id into v_size_id from sizes where code = upper(slugify(v_size_name)) or name = v_size_name limit 1;
            if v_size_id is null then
                insert into sizes (code, name, is_active)
                values (upper(slugify(v_size_name)), v_size_name, true)
                on conflict (code) do update set updated_at = now()
                returning id into v_size_id;
            end if;
        end if;

        -- Color
        v_color_name := btrim(coalesce(row_data->>'color_name', ''));
        v_color_id := null;
        if v_color_name <> '' then
            select id into v_color_id from colors where code = upper(slugify(v_color_name)) or name = v_color_name limit 1;
            if v_color_id is null then
                insert into colors (code, name, is_active)
                values (upper(slugify(v_color_name)), v_color_name, true)
                on conflict (code) do update set updated_at = now()
                returning id into v_color_id;
            end if;
        end if;

        -- INSERT ITEM (no update on conflict due to skip above)
        v_item_type := coalesce(row_data->>'type', 'FINISHED_GOOD');
        if v_item_type not in ('FINISHED_GOOD','RAW_MATERIAL','TRADED') then
            v_item_type := 'FINISHED_GOOD';
        end if;
        v_price_default := coalesce(
            (row_data->>'price_default')::numeric,
            (row_data->>'price_umum')::numeric,
            0
        );
        v_price_khusus := coalesce((row_data->>'price_khusus')::numeric, 0);
        v_def_price_buy := coalesce((row_data->>'purchase_price')::numeric, 0);
        v_min_stock := coalesce((row_data->>'min_stock')::numeric, 0);
        v_initial_stock := coalesce((row_data->>'initial_stock')::numeric, 0);
        
        insert into items (
            sku, name, type,
            uom_id, size_id, color_id,
            price_default, price_khusus, default_price_buy, min_stock,
            is_active
        )
        values (
            v_item_sku, v_item_name, v_item_type::item_type,
            v_uom_id, v_size_id, v_color_id,
            v_price_default, v_price_khusus, v_def_price_buy, v_min_stock,
            true
        )
        returning id into v_item_id;
        
        v_inserted_count := v_inserted_count + 1;
        
        -- OPENING STOCK (only once)
        if v_initial_stock > 0 then
            if not exists (
                select 1 from public.inventory_adjustments 
                where item_id = v_item_id 
                  and (reason = 'Opening Stock' or reason ilike 'opening%' or reason ilike '%import initial stock%')
            ) then
                insert into public.inventory_adjustments (item_id, qty_delta, reason, adjusted_at)
                values (v_item_id, v_initial_stock, 'Opening Stock', now());

                insert into public.inventory_stock (item_id, qty_on_hand, avg_cost, updated_at)
                values (v_item_id, v_initial_stock, v_def_price_buy, now())
                on conflict (item_id) do update
                set
                    avg_cost = case
                        when inventory_stock.qty_on_hand + excluded.qty_on_hand = 0 then excluded.avg_cost
                        when inventory_stock.qty_on_hand = 0 then excluded.avg_cost
                        else (inventory_stock.qty_on_hand * inventory_stock.avg_cost + excluded.qty_on_hand * excluded.avg_cost)
                            / (inventory_stock.qty_on_hand + excluded.qty_on_hand)
                    end,
                    qty_on_hand = inventory_stock.qty_on_hand + excluded.qty_on_hand,
                    updated_at = now();
            end if;
        end if;
        
    end loop;

    return jsonb_build_object(
        'success', true,
        'processed', v_processed_count,
        'inserted_or_updated', v_inserted_count + v_updated_count,
        'skipped', v_skipped_count
    );
end;
$$;
