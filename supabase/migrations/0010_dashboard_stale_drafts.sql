-- ============================================================
-- 0010_dashboard_stale_drafts.sql
-- Add Stale Draft Counts (> 2 days) to Dashboard RPC
-- ============================================================

set search_path = public;

create or replace function public.rpc_get_dashboard_metrics()
returns jsonb language plpgsql security definer as $$
declare
  v_sales_today numeric; v_sales_month numeric; v_sales_count_today int;
  v_purchases_month numeric; v_purchases_count_month int; v_low_stock_count int; v_total_items int;
  v_recent_sales jsonb; v_recent_purchases jsonb;
  -- Finance Health
  v_total_ar numeric; v_total_ap numeric; v_cash_balance numeric;
  v_cash_account_id uuid;
  -- Top Items
  v_top_items jsonb;
  -- Stale Drafts
  v_stale_draft_sales int; v_stale_draft_purchases int;
begin
  -- Sales & Inv
  select coalesce(sum(total_amount), 0), count(*) into v_sales_today, v_sales_count_today from public.sales where sales_date = current_date and status = 'POSTED';
  select coalesce(sum(total_amount), 0) into v_sales_month from public.sales where date_trunc('month', sales_date) = date_trunc('month', current_date) and status = 'POSTED';
  select coalesce(sum(total_amount), 0), count(*) into v_purchases_month, v_purchases_count_month from public.purchases where date_trunc('month', purchase_date) = date_trunc('month', current_date) and status = 'POSTED';
  select count(*) into v_total_items from public.items where is_active = true;
  select count(*) into v_low_stock_count from public.inventory_stock s join public.items i on s.item_id = i.id where i.is_active = true and s.qty_on_hand <= 5;

  -- Recent Sales
  select jsonb_agg(t) into v_recent_sales from (
    select s.id, s.sales_no, s.sales_date, c.name as customer_name, s.total_amount, s.status
    from public.sales s left join public.customers c on s.customer_id = c.id order by s.created_at desc limit 5
  ) t;

  -- Recent Purchases
  select jsonb_agg(t) into v_recent_purchases from (
    select p.id, p.purchase_no, p.purchase_date, v.name as vendor_name, p.total_amount, p.status
    from public.purchases p left join public.vendors v on p.vendor_id = v.id order by p.created_at desc limit 5
  ) t;
  
  -- Finance Health
  select coalesce(sum(outstanding_amount), 0) into v_total_ar from public.ar_invoices where status <> 'PAID';
  select coalesce(sum(outstanding_amount), 0) into v_total_ap from public.ap_bills where status <> 'PAID';
  
  -- Cash Balance
  select id into v_cash_account_id from public.accounts where code = '1100';
  select (
    coalesce((select sum(debit - credit) from public.opening_balances where account_id = v_cash_account_id), 0) +
    coalesce((select sum(debit - credit) from public.journal_lines where account_id = v_cash_account_id), 0)
  ) into v_cash_balance;

  -- Top 5 Items
  select jsonb_agg(t) into v_top_items from (
      select si.item_name, sum(si.qty) as total_qty, sum(si.subtotal) as total_amount
      from public.sales_items si
      join public.sales s on s.id = si.sales_id
      where s.status = 'POSTED' and date_trunc('month', s.sales_date) = date_trunc('month', current_date)
      group by si.item_name
      order by total_qty desc
      limit 5
  ) t;

  -- Stale Drafts (> 2 days)
  select count(*) into v_stale_draft_sales from public.sales where status = 'DRAFT' and created_at < now() - interval '2 days';
  select count(*) into v_stale_draft_purchases from public.purchases where status = 'DRAFT' and created_at < now() - interval '2 days';

  return jsonb_build_object(
    'sales_today', v_sales_today,
    'sales_month', v_sales_month,
    'sales_count_today', v_sales_count_today,
    'purchases_month', v_purchases_month,
    'purchases_count_month', v_purchases_count_month,
    'low_stock_count', v_low_stock_count,
    'total_items', v_total_items,
    'recent_sales', coalesce(v_recent_sales, '[]'::jsonb),
    'recent_purchases', coalesce(v_recent_purchases, '[]'::jsonb),
    'total_ar', v_total_ar,
    'total_ap', v_total_ap,
    'cash_balance', coalesce(v_cash_balance, 0),
    'top_items', coalesce(v_top_items, '[]'::jsonb),
    'stale_draft_sales', v_stale_draft_sales,
    'stale_draft_purchases', v_stale_draft_purchases
  );
end $$;
