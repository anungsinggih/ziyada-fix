-- ============================================================
-- 0019_add_sales_purchase_discount.sql
-- Add discount_amount to sales/purchases and update posting logic
-- ============================================================

alter table public.sales
add column if not exists discount_amount numeric(14,2) not null default 0;

alter table public.purchases
add column if not exists discount_amount numeric(14,2) not null default 0;

alter table public.sales
drop constraint if exists ck_sales_total_nonneg;
alter table public.sales
add constraint ck_sales_total_nonneg check (total_amount >= 0 and shipping_fee >= 0 and discount_amount >= 0);

alter table public.purchases
drop constraint if exists ck_purchase_total_nonneg;
alter table public.purchases
add constraint ck_purchase_total_nonneg check (total_amount >= 0 and discount_amount >= 0);

-- Add discount accounts if missing
insert into public.accounts (code, name, is_system_account)
values
  ('4120', 'Potongan Penjualan', true),
  ('5200', 'Potongan Pembelian', true)
on conflict (code) do update
set name = excluded.name,
    is_system_account = excluded.is_system_account;

-- Update sales posting to include discount and shipping
create or replace function public.rpc_post_sales(p_sales_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_sales record;
  v_items_total numeric(14,2);
  v_total numeric(14,2);
  v_total_cogs numeric(14,2);
  v_total_cogs_fg numeric(14,2);
  v_total_cogs_rm numeric(14,2);
  v_journal_id uuid;
  v_receipt_id uuid;
  v_ar_id uuid;
  v_line record;
  v_cash_acc_id uuid;
  v_ar_acc_id uuid;
  v_sales_acc_id uuid;
  v_sales_disc_acc_id uuid;
  v_inventory_acc_id uuid;
  v_rm_inventory_acc_id uuid;
  v_cogs_acc_id uuid;
  v_method text;
begin
  select id into v_ar_acc_id from public.accounts where code = '1200';
  select id into v_sales_acc_id from public.accounts where code = '4100';
  select id into v_sales_disc_acc_id from public.accounts where code = '4120';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inventory_acc_id from public.accounts where code = '1310';
  select id into v_cogs_acc_id from public.accounts where code = '5100';
  
  if v_ar_acc_id is null or v_sales_acc_id is null or v_inventory_acc_id is null or v_rm_inventory_acc_id is null or v_cogs_acc_id is null then
    raise exception 'COA Codes missing (1200, 4100, 1300, 1310, 5100)';
  end if;

  select * into v_sales from public.sales where id = p_sales_id for update;
  if not found then raise exception 'Sales not found'; end if;
  if v_sales.status <> 'DRAFT' then raise exception 'Sales must be DRAFT to post'; end if;
  if public.is_date_in_closed_period(v_sales.sales_date) then raise exception 'Periode CLOSED'; end if;

  select coalesce(sum(subtotal),0) into v_items_total from public.sales_items where sales_id = p_sales_id;
  if v_items_total <= 0 then raise exception 'Sales total must be > 0'; end if;
  v_total := v_items_total + coalesce(v_sales.shipping_fee, 0) - coalesce(v_sales.discount_amount, 0);
  if v_total < 0 then raise exception 'Sales total invalid'; end if;

  -- COGS
  select
    coalesce(sum(si.qty * coalesce(inv.avg_cost, i.default_price_buy)), 0)::numeric(14,2),
    coalesce(sum(si.qty * coalesce(inv.avg_cost, i.default_price_buy)) filter (where i.type in ('FINISHED_GOOD','TRADED')), 0)::numeric(14,2),
    coalesce(sum(si.qty * coalesce(inv.avg_cost, i.default_price_buy)) filter (where i.type = 'RAW_MATERIAL'), 0)::numeric(14,2)
  into v_total_cogs, v_total_cogs_fg, v_total_cogs_rm
  from public.sales_items si
  join public.items i on i.id = si.item_id
  left join public.inventory_stock inv on inv.item_id = i.id
  where si.sales_id = p_sales_id;

  -- Inventory decrease + snapshot
  for v_line in select si.id, si.item_id, si.qty, coalesce(inv.avg_cost, i.default_price_buy)::numeric(14,4) as cost_basis
                from public.sales_items si
                join public.items i on i.id = si.item_id
                left join public.inventory_stock inv on inv.item_id = i.id
                where si.sales_id = p_sales_id loop
    perform public.apply_stock_delta(v_line.item_id, -v_line.qty);
    update public.sales_items set avg_cost_snapshot = v_line.cost_basis where id = v_line.id;
  end loop;

  update public.sales set status = 'POSTED', total_amount = v_total, updated_at = now() where id = p_sales_id;
  v_journal_id := public.create_journal(v_sales.sales_date, 'sales', p_sales_id, 'POST Sales ' || coalesce(v_sales.sales_no, ''));

  if v_sales.terms = 'CASH' then
    v_method := upper(coalesce(v_sales.payment_method_code, 'CASH'));
    v_cash_acc_id := public.get_payment_account_for_method(v_method);
    insert into public.receipts(receipt_date, source, ref_type, ref_id, amount, method, is_petty_cash)
    values (v_sales.sales_date, 'SALES_CASH', 'sales', p_sales_id, v_total, v_method, false)
    returning id into v_receipt_id;
    perform public.add_journal_line(v_journal_id, v_cash_acc_id, v_total, 0, 'Cash received');
  else
    insert into public.ar_invoices(sales_id, customer_id, invoice_date, total_amount, outstanding_amount, status)
    values (p_sales_id, v_sales.customer_id, v_sales.sales_date, v_total, v_total, 'UNPAID')
    returning id into v_ar_id;
    perform public.add_journal_line(v_journal_id, v_ar_acc_id, v_total, 0, 'AR created');
  end if;

  -- Revenue (gross) + discount
  perform public.add_journal_line(v_journal_id, v_sales_acc_id, 0, (v_items_total + coalesce(v_sales.shipping_fee, 0)), 'Sales revenue');
  if coalesce(v_sales.discount_amount, 0) > 0 and v_sales_disc_acc_id is not null then
    perform public.add_journal_line(v_journal_id, v_sales_disc_acc_id, coalesce(v_sales.discount_amount, 0), 0, 'Sales discount');
  end if;

  if v_total_cogs > 0 then
    perform public.add_journal_line(v_journal_id, v_cogs_acc_id, v_total_cogs, 0, 'COGS');
    if v_total_cogs_fg > 0 then
      perform public.add_journal_line(v_journal_id, v_inventory_acc_id, 0, v_total_cogs_fg, 'Inventory reduction (FG)');
    end if;
    if v_total_cogs_rm > 0 then
      perform public.add_journal_line(v_journal_id, v_rm_inventory_acc_id, 0, v_total_cogs_rm, 'Inventory reduction (RM)');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'sales_id', p_sales_id,
    'journal_id', v_journal_id,
    'receipt_id', v_receipt_id,
    'ar_invoice_id', v_ar_id
  );
end $$;

-- Update purchase posting to include discount
create or replace function public.rpc_post_purchase(p_purchase_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_purchase record;
  v_items_total numeric(14,2);
  v_total numeric(14,2);
  v_total_fg numeric(14,2);
  v_total_rm numeric(14,2);
  v_journal_id uuid;
  v_ap_id uuid;
  v_line record;
  v_prev_qty numeric(14,3);
  v_prev_avg numeric(14,4);
  v_new_qty numeric(14,3);
  v_new_avg numeric(14,4);
  v_cash_acc_id uuid;
  v_ap_acc_id uuid;
  v_inventory_acc_id uuid;
  v_rm_inventory_acc_id uuid;
  v_purchase_disc_acc_id uuid;
  v_method text;
begin
  select id into v_ap_acc_id from public.accounts where code = '2100';
  select id into v_inventory_acc_id from public.accounts where code = '1300';
  select id into v_rm_inventory_acc_id from public.accounts where code = '1310';
  select id into v_purchase_disc_acc_id from public.accounts where code = '5200';
  
  if v_ap_acc_id is null or v_inventory_acc_id is null or v_rm_inventory_acc_id is null then
    raise exception 'COA Codes missing (2100, 1300, 1310)';
  end if;
  
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_purchase.status <> 'DRAFT' then raise exception 'Purchase must be DRAFT'; end if;
  if public.is_date_in_closed_period(v_purchase.purchase_date) then raise exception 'Periode CLOSED'; end if;
  
  select
    coalesce(sum(pi.subtotal),0),
    coalesce(sum(pi.subtotal) filter (where i.type in ('FINISHED_GOOD','TRADED')),0),
    coalesce(sum(pi.subtotal) filter (where i.type = 'RAW_MATERIAL'),0)
  into v_items_total, v_total_fg, v_total_rm
  from public.purchase_items pi
  join public.items i on i.id = pi.item_id
  where pi.purchase_id = p_purchase_id;
  if v_items_total <= 0 then raise exception 'Purchase total must > 0'; end if;

  v_total := v_items_total - coalesce(v_purchase.discount_amount, 0);
  if v_total < 0 then raise exception 'Purchase total invalid'; end if;

  -- Inventory Increase + Avg Cost
  for v_line in select item_id, qty, unit_cost from public.purchase_items where purchase_id = p_purchase_id loop
    perform public.ensure_stock_row(v_line.item_id);
    select qty_on_hand, avg_cost into v_prev_qty, v_prev_avg from public.inventory_stock where item_id = v_line.item_id for update;
    v_new_qty := coalesce(v_prev_qty, 0) + v_line.qty;
    if v_new_qty > 0 then
      v_new_avg := (coalesce(v_prev_qty, 0) * coalesce(v_prev_avg, 0) + v_line.qty * v_line.unit_cost) / v_new_qty;
    else
      v_new_avg := 0;
    end if;
    update public.inventory_stock set avg_cost = v_new_avg where item_id = v_line.item_id;
    perform public.apply_stock_delta(v_line.item_id, v_line.qty);
  end loop;

  update public.purchases set status = 'POSTED', total_amount = v_total, updated_at = now() where id = p_purchase_id;
  v_journal_id := public.create_journal(v_purchase.purchase_date, 'purchase', p_purchase_id, 'POST Purchase ' || coalesce(v_purchase.purchase_no, ''));

  if v_purchase.terms = 'CASH' then
    v_method := upper(coalesce(v_purchase.payment_method_code, 'CASH'));
    v_cash_acc_id := public.get_payment_account_for_method(v_method);
    if v_total_fg > 0 then perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total_fg, 0, 'Inventory purchased (FG/Traded)'); end if;
    if v_total_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_inventory_acc_id, v_total_rm, 0, 'Inventory purchased (RM)'); end if;
    if coalesce(v_purchase.discount_amount, 0) > 0 and v_purchase_disc_acc_id is not null then
      perform public.add_journal_line(v_journal_id, v_purchase_disc_acc_id, 0, coalesce(v_purchase.discount_amount, 0), 'Purchase discount');
    end if;
    perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, v_total, 'Cash paid');
  else
    insert into public.ap_bills(purchase_id, vendor_id, bill_date, total_amount, outstanding_amount, status)
    values (p_purchase_id, v_purchase.vendor_id, v_purchase.purchase_date, v_total, v_total, 'UNPAID')
    returning id into v_ap_id;
    if v_total_fg > 0 then perform public.add_journal_line(v_journal_id, v_inventory_acc_id, v_total_fg, 0, 'Inventory purchased (FG/Traded)'); end if;
    if v_total_rm > 0 then perform public.add_journal_line(v_journal_id, v_rm_inventory_acc_id, v_total_rm, 0, 'Inventory purchased (RM)'); end if;
    if coalesce(v_purchase.discount_amount, 0) > 0 and v_purchase_disc_acc_id is not null then
      perform public.add_journal_line(v_journal_id, v_purchase_disc_acc_id, 0, coalesce(v_purchase.discount_amount, 0), 'Purchase discount');
    end if;
    perform public.add_journal_line(v_journal_id, v_ap_acc_id, 0, v_total, 'AP created');
  end if;

  return jsonb_build_object(
    'ok', true,
    'purchase_id', p_purchase_id,
    'journal_id', v_journal_id,
    'ap_bill_id', v_ap_id
  );
end $$;
