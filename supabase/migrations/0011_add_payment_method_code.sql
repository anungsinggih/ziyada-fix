-- Add payment method code for cash transactions (sales & purchases)
alter table if exists public.sales
  add column if not exists payment_method_code text;

alter table if exists public.purchases
  add column if not exists payment_method_code text;

comment on column public.sales.payment_method_code is 'Payment method code for CASH terms (references payment_methods.code)';
comment on column public.purchases.payment_method_code is 'Payment method code for CASH terms (references payment_methods.code)';

-- Backfill for existing rows to satisfy constraint
update public.sales
set payment_method_code = 'CASH'
where terms = 'CASH' and (payment_method_code is null or payment_method_code = '');

update public.sales
set payment_method_code = null
where terms <> 'CASH';

update public.purchases
set payment_method_code = 'CASH'
where terms = 'CASH' and (payment_method_code is null or payment_method_code = '');

update public.purchases
set payment_method_code = null
where terms <> 'CASH';

-- Guard: CASH requires payment_method_code (CREDIT must be null)
alter table if exists public.sales
  drop constraint if exists ck_sales_cash_method,
  add constraint ck_sales_cash_method
  check (
    (terms = 'CASH' and coalesce(payment_method_code, '') <> '') or
    (terms <> 'CASH' and payment_method_code is null)
  );

alter table if exists public.purchases
  drop constraint if exists ck_purchases_cash_method,
  add constraint ck_purchases_cash_method
  check (
    (terms = 'CASH' and coalesce(payment_method_code, '') <> '') or
    (terms <> 'CASH' and payment_method_code is null)
  );
