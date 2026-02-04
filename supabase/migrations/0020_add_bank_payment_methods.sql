-- ============================================================
-- 0020_add_bank_payment_methods.sql
-- Add COA and payment methods for BCA & BRI
-- ============================================================

-- COA (Bank accounts)
insert into public.accounts (code, name, is_system_account)
values
  ('1100', 'Kas', true),
  ('1111', 'Bank BCA', true),
  ('1110', 'Bank BRI', true)
on conflict (code) do update
set name = excluded.name,
    is_system_account = excluded.is_system_account;

-- Repoint any payment methods using deprecated BRI (1112) to 1110, then remove 1112
update public.payment_methods
set account_id = (select id from public.accounts where code = '1110')
where account_id = (select id from public.accounts where code = '1112');

delete from public.accounts where code = '1112';

-- Payment Methods
insert into public.payment_methods (code, name, account_id)
values
  ('CASH', 'Kas Tunai', (select id from public.accounts where code = '1100')),
  ('BCA', 'Bank BCA', (select id from public.accounts where code = '1111')),
  ('BRI', 'Bank BRI', (select id from public.accounts where code = '1110'))
on conflict (code) do update
set name = excluded.name,
    account_id = excluded.account_id,
    is_active = true;

-- Deactivate legacy generic bank method
update public.payment_methods
set is_active = false
where code = 'BANK';
