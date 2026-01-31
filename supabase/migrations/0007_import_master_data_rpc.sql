-- Migration: 0007_import_master_data_rpc.sql

-- Helper function to generate slug from name (for codes)
create or replace function public.slugify(value text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(trim(value)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Primary Import RPC
create or replace function public.import_master_data(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    row_data jsonb;
    
    -- IDs
    v_brand_id uuid;
    v_category_id uuid;
    v_parent_id uuid;
    v_uom_id uuid;
    v_size_id uuid;
    v_color_id uuid;
    
    -- Names & Codes
    v_brand_name text;
    v_category_name text;
    v_parent_name text;
    v_uom_name text;
    v_size_name text;
    v_color_name text;
    
    v_item_sku text;
    v_item_name text;
    v_item_type text;
    
    v_price_umum numeric;
    v_price_khusus numeric;
    v_def_price_buy numeric;
    v_min_stock numeric;
    
    -- Stats
    v_processed_count int := 0;
    v_inserted_count int := 0;
    v_updated_count int := 0;
begin
    -- Iterate through rows
    for row_data in select * from jsonb_array_elements(data)
    loop
        v_processed_count := v_processed_count + 1;
        
        -- 1. Extract values safely
        v_item_sku := btrim(coalesce(row_data->>'sku', ''));
        v_item_name := btrim(coalesce(row_data->>'name', ''));
        
        -- Skip invalid rows
        if v_item_sku = '' or v_item_name = '' then
            continue;
        end if;
        
        -- 2. BRAND (Optional)
        v_brand_name := btrim(coalesce(row_data->>'brand_name', ''));
        v_brand_id := null;
        if v_brand_name <> '' then
            insert into brands (name, is_active) values (v_brand_name, true)
            on conflict (name) do update set updated_at = now() returning id into v_brand_id;
        end if;
        
        -- 3. CATEGORY (Optional)
        v_category_name := btrim(coalesce(row_data->>'category_name', ''));
        v_category_id := null;
        if v_category_name <> '' then
             insert into categories (name, is_active) values (v_category_name, true)
            on conflict (name) do update set updated_at = now() returning id into v_category_id;
        end if;
        
        -- 4. PARENT PRODUCT (Optional but recommended)
        v_parent_name := btrim(coalesce(row_data->>'parent_name', ''));
        if v_parent_name = '' then
            -- Fallback: Use Item Name as parent name if not provided (assume simple product) or skip
            -- Ideally, we group by parent_name. If empty, maybe create a parent based on item name?
            -- Let's assume input might have `parent_name`. If not, we can try to guess or create one per item.
            -- Strategy: If NO parent_name, create one with Item Name.
             v_parent_name := v_item_name;
        end if;

        -- Create/Get Parent
        -- We rely on NAME uniqueness logic for import roughly, but schema allows duplicates if code is null.
        -- To prevent duplicate parents with same name, we try to find one first.
        select id into v_parent_id from product_parents where name = v_parent_name limit 1;
        
        if v_parent_id is null then
            insert into product_parents (name, brand_id, category_id, is_active)
            values (v_parent_name, v_brand_id, v_category_id, true)
            returning id into v_parent_id;
        else
            -- Update brand/category if provided
            update product_parents 
            set brand_id = coalesce(v_brand_id, brand_id),
                category_id = coalesce(v_category_id, category_id),
                updated_at = now()
            where id = v_parent_id;
        end if;
        
        -- 5. ATTRIBUTES (UOM, Size, Color)
        -- UoM
        v_uom_name := btrim(coalesce(row_data->>'uom_name', 'PCS'));
        if v_uom_name = '' then v_uom_name := 'PCS'; end if;
        
        select id into v_uom_id from uoms where code = slugify(v_uom_name) or name = v_uom_name limit 1;
        if v_uom_id is null then
            insert into uoms (code, name, is_active)
            values (slugify(v_uom_name), v_uom_name, true)
            on conflict (code) do update set updated_at = now() returning id into v_uom_id;
        end if;

        -- Size
        v_size_name := btrim(coalesce(row_data->>'size_name', ''));
        v_size_id := null;
        if v_size_name <> '' then
            select id into v_size_id from sizes where code = slugify(v_size_name) or name = v_size_name limit 1;
            if v_size_id is null then
                insert into sizes (code, name, is_active)
                values (slugify(v_size_name), v_size_name, true)
                on conflict (code) do update set updated_at = now() returning id into v_size_id;
            end if;
        end if;

        -- Color
        v_color_name := btrim(coalesce(row_data->>'color_name', ''));
        v_color_id := null;
        if v_color_name <> '' then
            select id into v_color_id from colors where code = slugify(v_color_name) or name = v_color_name limit 1;
            if v_color_id is null then
                insert into colors (code, name, is_active)
                values (slugify(v_color_name), v_color_name, true)
                on conflict (code) do update set updated_at = now() returning id into v_color_id;
            end if;
        end if;

        -- 6. UPSERT ITEM
        v_item_type := coalesce(row_data->>'type', 'FINISHED_GOOD');
        v_price_umum := coalesce((row_data->>'price_umum')::numeric, 0);
        v_price_khusus := coalesce((row_data->>'price_khusus')::numeric, 0);
        v_def_price_buy := coalesce((row_data->>'purchase_price')::numeric, 0);
        v_min_stock := coalesce((row_data->>'min_stock')::numeric, 0);
        
        insert into items (
            sku, name, type, parent_id,
            uom_id, size_id, color_id,
            price_umum, price_khusus, default_price_buy, min_stock,
            is_active
        )
        values (
            v_item_sku, v_item_name, v_item_type::item_type, v_parent_id,
            v_uom_id, v_size_id, v_color_id,
            v_price_umum, v_price_khusus, v_def_price_buy, v_min_stock,
            true
        )
        on conflict (sku) do update
        set
            name = excluded.name,
            parent_id = excluded.parent_id,
            uom_id = excluded.uom_id,
            size_id = excluded.size_id,
            color_id = excluded.color_id,
            price_umum = excluded.price_umum,
            price_khusus = excluded.price_khusus,
            default_price_buy = excluded.default_price_buy,
            min_stock = excluded.min_stock,
            updated_at = now();
            
        if found then
            v_updated_count := v_updated_count + 1;
        else
            v_inserted_count := v_inserted_count + 1;
        end if;
        
    end loop;

    return jsonb_build_object(
        'success', true,
        'processed', v_processed_count,
        'inserted_or_updated', v_processed_count -- Approximation since ON CONFLICT always touches
    );
end;
$$;
