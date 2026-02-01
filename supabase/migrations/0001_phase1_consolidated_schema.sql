-- ============================================================
-- 0001_phase1_consolidated_schema.sql
-- PHASE 1 MVP (Consolidated) - Admin & Owner
-- Includes: Master Data, Sales, Purchase, Inventory, AR/AP, Finance, Security
-- Merges: 0001, 013, 015, 023, 024, 025, 027, 029, 030
-- ============================================================

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Enums (idempotent)
do $$ begin create type app_role as enum ('ADMIN', 'OWNER'); exception when duplicate_object then null; end $$;
do $$ begin create type item_type as enum ('FINISHED_GOOD', 'RAW_MATERIAL', 'TRADED'); exception when duplicate_object then null; end $$;
do $$ begin create type price_tier as enum ('UMUM', 'KHUSUS'); exception when duplicate_object then null; end $$;
do $$ begin create type terms_type as enum ('CASH', 'CREDIT'); exception when duplicate_object then null; end $$;
do $$ begin create type doc_status as enum ('DRAFT', 'POSTED', 'VOID'); exception when duplicate_object then null; end $$;
do $$ begin create type sales_channel as enum ('DIRECT', 'MARKETPLACE'); exception when duplicate_object then null; end $$;
do $$ begin create type receipt_source as enum ('SALES_CASH', 'AR_PAYMENT', 'MARKETPLACE'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_source as enum ('PURCHASE_CASH', 'AP_PAYMENT'); exception when duplicate_object then null; end $$;
do $$ begin create type period_status as enum ('OPEN', 'CLOSED'); exception when duplicate_object then null; end $$;

-- 2) Utility: updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ============================================================
-- 3) USERS & SECURITY
-- ============================================================
create table if not exists public.signup_whitelist (
  email text primary key,
  invited_role app_role not null,
  invited_by uuid references auth.users(id),
  invited_at timestamp with time zone default now(),
  notes text
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at before update on public.user_profiles for each row execute function set_updated_at();

-- Trigger to auto-create user_profile (from 015 - Whitelist Enforced)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role app_role;
begin
  -- Check if email is in whitelist
  select invited_role into v_role from public.signup_whitelist where email = new.email;
  
  if v_role is null then
    raise exception 'SIGNUP_NOT_AUTHORIZED: Invite-only system.';
  end if;
  
  insert into public.user_profiles (id, role, full_name)
  values (new.id, v_role, new.email);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Utility: Invite User
create or replace function public.invite_user(p_email text, p_role app_role, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_profiles where id = auth.uid() and role = 'OWNER') then
    raise exception 'PERMISSION_DENIED: Only OWNER can invite users.';
  end if;
  insert into public.signup_whitelist (email, invited_role, invited_by, notes)
  values (p_email, p_role, auth.uid(), p_notes)
  on conflict (email) do update set invited_role = excluded.invited_role, invited_by = excluded.invited_by, invited_at = now(), notes = excluded.notes;
end;
$$;

create or replace function public.revoke_invitation(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_profiles where id = auth.uid() and role = 'OWNER') then
    raise exception 'PERMISSION_DENIED: Only OWNER can revoke invitations.';
  end if;
  delete from public.signup_whitelist where email = p_email;
end;
$$;

-- ============================================================
-- 4) MASTER DATA (Extended from 0001, 027, 030)
-- ============================================================

-- UoM, Size, Color (from 027)
create table if not exists public.uoms (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_uoms_code unique (code)
);
create trigger trg_uoms_updated_at before update on public.uoms for each row execute function set_updated_at();

create table if not exists public.sizes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_sizes_code unique (code)
);
create trigger trg_sizes_updated_at before update on public.sizes for each row execute function set_updated_at();

create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_colors_code unique (code)
);
create trigger trg_colors_updated_at before update on public.colors for each row execute function set_updated_at();

-- Brand & Category (from 027)
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_brands_name unique (name)
);
create trigger trg_brands_updated_at before update on public.brands for each row execute function set_updated_at();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_categories_name unique (name)
);
create trigger trg_categories_updated_at before update on public.categories for each row execute function set_updated_at();

-- Product Parents (from 027 + 030)
create table if not exists public.product_parents (
  id uuid primary key default gen_random_uuid(),
  code text unique, -- Added from 030
  name text not null,
  brand_id uuid references public.brands(id),
  category_id uuid references public.categories(id),
  image_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_product_parents_name on public.product_parents(name);
create trigger trg_product_parents_updated_at before update on public.product_parents for each row execute function set_updated_at();

-- Customers & Vendors (0001)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  price_tier price_tier not null default 'UMUM',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_name on public.customers (name);
create trigger trg_customers_updated_at before update on public.customers for each row execute function set_updated_at();

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vendors_name on public.vendors (name);
create trigger trg_vendors_updated_at before update on public.vendors for each row execute function set_updated_at();

-- Items (Merged 0001 + 027)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  type item_type not null,
  
  parent_id uuid references public.product_parents(id),
  uom_id uuid references public.uoms(id),
  size_id uuid references public.sizes(id),
  color_id uuid references public.colors(id),
  
  uom text not null default 'PCS', -- Legacy
  
  price_umum numeric(14,2) not null default 0,
  price_khusus numeric(14,2) not null default 0,
  default_price_buy numeric(14,2) not null default 0,
  min_stock numeric(14,3) not null default 0,
  
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint uq_items_sku unique (sku),
  constraint ck_items_prices_nonneg check (
    price_umum >= 0 and price_khusus >= 0 and default_price_buy >= 0
  ),
  constraint ck_items_min_stock_nonneg check (min_stock >= 0)
);
create index if not exists idx_items_name on public.items (name);
create index if not exists idx_items_parent_id on public.items(parent_id);
create index if not exists idx_items_uom_id on public.items(uom_id);
create index if not exists idx_items_size_id on public.items(size_id);
create index if not exists idx_items_color_id on public.items(color_id);
create trigger trg_items_updated_at before update on public.items for each row execute function set_updated_at();

-- ============================================================
-- 5) INVENTORY
-- ============================================================
create table if not exists public.inventory_stock (
  item_id uuid primary key references public.items(id) on delete restrict,
  qty_on_hand numeric(14,3) not null default 0,
  avg_cost numeric(14,4) not null default 0,
  updated_at timestamptz not null default now(),
  constraint ck_stock_nonneg check (qty_on_hand >= 0)
);
create trigger trg_inventory_stock_updated_at before update on public.inventory_stock for each row execute function set_updated_at();

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  qty_delta numeric(14,3) not null,
  reason text,
  adjusted_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_inv_adj_item on public.inventory_adjustments (item_id, adjusted_at desc);

-- ============================================================
-- 6) COA & ACCOUNTING
-- ============================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  is_system_account boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_accounts_code unique (code)
);
create index if not exists idx_accounts_name on public.accounts (name);
create trigger trg_accounts_updated_at before update on public.accounts for each row execute function set_updated_at();

create table if not exists public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  as_of_date date not null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint ck_opening_dc check (
    debit >= 0 and credit >= 0 and not (debit > 0 and credit > 0)
  ),
  constraint uq_opening_per_date_account unique (as_of_date, account_id)
);

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  journal_date date not null,
  ref_type text not null,
  ref_id uuid not null,
  memo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_journals_ref on public.journals (ref_type, ref_id);
create index if not exists idx_journals_date on public.journals (journal_date desc);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  line_memo text,
  constraint ck_jl_dc check (
    debit >= 0 and credit >= 0 and not (debit > 0 and credit > 0)
  )
);
create index if not exists idx_journal_lines_journal on public.journal_lines (journal_id);
create index if not exists idx_journal_lines_account on public.journal_lines (account_id);

create table if not exists public.payment_methods (
  code text primary key,
  name text not null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7) TRANSACTIONS (Docs & Tables)
-- ============================================================

-- DOC NUMBERING
create table if not exists public.tx_doc_sequences (
  prefix text not null,
  period text not null,
  last_seq int not null default 0,
  primary key (prefix, period)
);

-- Generator
create or replace function public.generate_tx_doc_no(p_prefix text, p_ts timestamptz default now())
returns text language plpgsql volatile as $$
declare
  v_period text := to_char((p_ts AT TIME ZONE 'Asia/Jakarta'), 'YYYYMMDD');
  v_ts text := to_char((p_ts AT TIME ZONE 'Asia/Jakarta'), 'YYYYMMDDHH24MI');
  v_seq int;
begin
  insert into public.tx_doc_sequences(prefix, period, last_seq) values (p_prefix, v_period, 1)
  on conflict (prefix, period) do update set last_seq = public.tx_doc_sequences.last_seq + 1 returning public.tx_doc_sequences.last_seq into v_seq;
  return format('%s-%s%04s', upper(p_prefix), v_ts, lpad(v_seq::text, 4, '0'));
end $$;


-- PURCHASES
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_no text,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  purchase_date date not null default current_date,
  terms terms_type not null,
  status doc_status not null default 'DRAFT',
  notes text,
  total_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint ck_purchase_total_nonneg check (total_amount >= 0)
);
create index if not exists idx_purchases_date on public.purchases (purchase_date desc);
create trigger trg_purchases_updated_at before update on public.purchases for each row execute function set_updated_at();

-- Auto Number
create or replace function public.set_purchase_document_number() returns trigger language plpgsql as $$
begin if coalesce(trim(new.purchase_no), '') = '' then new.purchase_no := public.generate_tx_doc_no('PUR', now()); end if; return new; end $$;
create trigger trg_purchases_auto_no before insert on public.purchases for each row execute function public.set_purchase_document_number();

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  uom_snapshot text not null,
  qty numeric(14,3) not null,
  unit_cost numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  constraint ck_purchase_item_nonneg check (qty > 0 and unit_cost >= 0 and subtotal >= 0)
);
create index if not exists idx_purchase_items_purchase on public.purchase_items (purchase_id);


-- AP
create table if not exists public.ap_bills (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.purchases(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  bill_date date not null,
  total_amount numeric(14,2) not null,
  outstanding_amount numeric(14,2) not null,
  status text not null default 'UNPAID',
  created_at timestamptz not null default now(),
  constraint ck_ap_amounts check (total_amount >= 0 and outstanding_amount >= 0 and outstanding_amount <= total_amount)
);
create index if not exists idx_ap_status on public.ap_bills (status);


-- SALES
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sales_no text,
  customer_id uuid references public.customers(id) on delete restrict,
  sales_date date not null default current_date,
  terms terms_type not null,
  channel sales_channel not null default 'DIRECT',
  external_order_id text,
  status doc_status not null default 'DRAFT',
  notes text,
  total_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint ck_sales_total_nonneg check (total_amount >= 0),
  constraint uq_sales_marketplace_order unique (channel, external_order_id) deferrable initially immediate
);
create index if not exists idx_sales_date on public.sales (sales_date desc);
create trigger trg_sales_updated_at before update on public.sales for each row execute function set_updated_at();

-- Auto Number
create or replace function public.set_sales_document_number() returns trigger language plpgsql as $$
begin if coalesce(trim(new.sales_no), '') = '' then new.sales_no := public.generate_tx_doc_no('SAL', now()); end if; return new; end $$;
create trigger trg_sales_auto_no before insert on public.sales for each row execute function public.set_sales_document_number();

create table if not exists public.sales_items (
  id uuid primary key default gen_random_uuid(),
  sales_id uuid not null references public.sales(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  uom_snapshot text not null,
  qty numeric(14,3) not null,
  unit_price numeric(14,2) not null default 0,
  avg_cost_snapshot numeric(14,4) not null default 0,
  price_tier_applied price_tier not null default 'UMUM',
  subtotal numeric(14,2) not null default 0,
  constraint ck_sales_item_nonneg check (qty > 0 and unit_price >= 0 and subtotal >= 0)
);


-- AR
create table if not exists public.ar_invoices (
  id uuid primary key default gen_random_uuid(),
  sales_id uuid not null unique references public.sales(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete restrict,
  invoice_date date not null,
  total_amount numeric(14,2) not null,
  outstanding_amount numeric(14,2) not null,
  status text not null default 'UNPAID',
  created_at timestamptz not null default now(),
  constraint ck_ar_amounts check (total_amount >= 0 and outstanding_amount >= 0 and outstanding_amount <= total_amount)
);
create index if not exists idx_ar_status on public.ar_invoices (status);


-- RETURNS
create table if not exists public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  return_no text unique,
  sales_id uuid not null references public.sales(id) on delete restrict,
  return_date date not null default current_date,
  status doc_status not null default 'DRAFT',
  notes text,
  total_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint ck_return_total_nonneg check (total_amount >= 0)
);
create trigger trg_sales_returns_updated_at before update on public.sales_returns for each row execute function set_updated_at();

-- Auto Number
create or replace function public.set_sales_return_document_number() returns trigger language plpgsql as $$
begin if coalesce(trim(new.return_no), '') = '' then new.return_no := public.generate_tx_doc_no('SRET', now()); end if; return new; end $$;
create trigger trg_sales_returns_auto_no before insert on public.sales_returns for each row execute function public.set_sales_return_document_number();

create table if not exists public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  sales_return_id uuid not null references public.sales_returns(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  uom_snapshot text not null,
  qty numeric(14,3) not null,
  unit_price numeric(14,2) not null default 0,
  cost_snapshot numeric(14,4) not null default 0,
  subtotal numeric(14,2) not null default 0,
  constraint ck_sales_return_item_nonneg check (qty > 0 and unit_price >= 0 and subtotal >= 0)
);

create table if not exists public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  return_no text unique,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  return_date date not null default current_date,
  status doc_status not null default 'DRAFT',
  notes text,
  total_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint ck_purchase_return_total_nonneg check (total_amount >= 0)
);
create trigger trg_purchase_returns_updated_at before update on public.purchase_returns for each row execute function set_updated_at();

-- Auto Number
create or replace function public.set_purchase_return_document_number() returns trigger language plpgsql as $$
begin if coalesce(trim(new.return_no), '') = '' then new.return_no := public.generate_tx_doc_no('PRET', now()); end if; return new; end $$;
create trigger trg_purchase_returns_auto_no before insert on public.purchase_returns for each row execute function public.set_purchase_return_document_number();

create table if not exists public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  purchase_return_id uuid not null references public.purchase_returns(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  uom_snapshot text not null,
  qty numeric(14,3) not null,
  unit_cost numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  constraint ck_purchase_return_item_nonneg check (qty > 0 and unit_cost >= 0 and subtotal >= 0)
);


-- RECEIPTS & PAYMENTS
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text,
  receipt_date date not null default current_date,
  source receipt_source not null,
  ref_type text not null,
  ref_id uuid not null,
  amount numeric(14,2) not null,
  method text,
  is_petty_cash boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint ck_receipt_amount_nonneg check (amount >= 0),
  constraint ck_petty_cash_limit check ((is_petty_cash = false) or (amount <= 500000))
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text,
  payment_date date not null default current_date,
  source payment_source not null,
  ref_type text not null,
  ref_id uuid not null,
  amount numeric(14,2) not null,
  method text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint ck_payment_amount_nonneg check (amount >= 0)
);


-- ============================================================
-- 8) PERIOD LOCK & EXPORTS
-- ============================================================
create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status period_status not null default 'OPEN',
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_period_range check (start_date <= end_date),
  constraint uq_period_range unique (start_date, end_date)
);
create trigger trg_accounting_periods_updated_at before update on public.accounting_periods for each row execute function set_updated_at();

create table if not exists public.period_exports (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete cascade,
  report_type text not null,
  exported_at timestamptz not null default now(),
  exported_by uuid references auth.users(id) on delete set null,
  file_ref text,
  notes text
);

-- Helper for Lock
create or replace function public.is_date_in_closed_period(d date) returns boolean language sql stable as $$
  select exists (select 1 from public.accounting_periods p where p.status = 'CLOSED' and d between p.start_date and p.end_date);
$$;

-- ============================================================
-- 9) COMPANY PROFILE (024)
-- ============================================================
create table if not exists public.company_profile (
    id uuid not null default gen_random_uuid() primary key,
    name text not null,
    address text,
    phone text,
    email text,
    website text,
    tax_id text,
    bank_name text,
    bank_account text,
    bank_holder text,
    logo_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create trigger trg_company_profile_updated_at before update on public.company_profile for each row execute function set_updated_at();

-- ============================================================
-- 10) STORAGE (029)
-- ============================================================
insert into storage.buckets (id, name, public) 
values ('images', 'images', true)
on conflict (id) do nothing;
