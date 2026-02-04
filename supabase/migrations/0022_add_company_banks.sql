-- ============================================================
-- 0022_add_company_banks.sql
-- Add multi bank setup for invoice/print
-- ============================================================

create table if not exists public.company_banks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_company_banks_code unique (code)
);

drop trigger if exists trg_company_banks_updated_at on public.company_banks;
create trigger trg_company_banks_updated_at before update on public.company_banks
for each row execute function set_updated_at();

-- Ensure only one default
create unique index if not exists uq_company_banks_default on public.company_banks ((is_default))
where is_default;

-- Seed from company_profile if present and banks empty
insert into public.company_banks (code, bank_name, account_number, account_holder, is_active, is_default)
select upper(slugify(bank_name)), bank_name, bank_account, bank_holder, true, true
from public.company_profile
where coalesce(bank_name, '') <> ''
  and not exists (select 1 from public.company_banks);

alter table public.company_banks enable row level security;
drop policy if exists "company_banks_rw" on public.company_banks;
create policy "company_banks_rw" on public.company_banks
for all to authenticated
using (public.is_admin() or public.is_owner())
with check (public.is_admin() or public.is_owner());
