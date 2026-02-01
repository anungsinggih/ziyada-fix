-- ============================================================
-- 0002_phase1_consolidated_seed.sql
-- PHASE 1 SEED DATA (Minimal & Idempotent)
-- Merges: 0002, 020 (payment methods), 027 (master defaults), 024 (company profile)
-- ============================================================

set search_path = public;

-- 1) COA SEED (Minimal)
insert into public.accounts (code, name, is_system_account)
values
  ('1100', 'Kas', true),
  ('1110', 'Bank', true),
  ('1200', 'Piutang Usaha', true),
  ('1300', 'Persediaan Barang Jadi', true),
  ('1310', 'Persediaan Bahan Baku', true), -- Added for separation
  ('2100', 'Hutang Usaha', true),
  ('4100', 'Penjualan', true),
  ('4110', 'Retur Penjualan', true), -- Added for returns
  ('5100', 'Harga Pokok Penjualan', true),
  ('6100', 'Beban Operasional', true) -- Adjustment Expense
on conflict (code) do update
set name = excluded.name,
    is_system_account = excluded.is_system_account;

-- 2) MASTER DEFAULTS (UoM, Size, Color)
insert into public.uoms (code, name)
select 'PCS', 'Pieces'
where not exists (select 1 from public.uoms where code = 'PCS');

insert into public.sizes (code, name)
select 'ALL', 'All Size'
where not exists (select 1 from public.sizes where code = 'ALL');

insert into public.colors (code, name)
select 'NA', 'No Color'
where not exists (select 1 from public.colors where code = 'NA');

-- 3) PAYMENT METHODS
insert into public.payment_methods (code, name, account_id)
values
  ('CASH', 'Kas Tunai', (select id from public.accounts where code = '1100')),
  ('BANK', 'Bank Utama', (select id from public.accounts where code = '1110'))
on conflict (code) do update
set name = excluded.name,
    account_id = excluded.account_id,
    is_active = true;

-- 4) COMPANY PROFILE (Default Mock)
insert into public.company_profile (name, address, phone, email, bank_name, bank_account, bank_holder)
select 
    'PT. KONVEKSI MAJU JAYA',
    'Jl. Industri No. 123, Bandung, Jawa Barat 40287',
    '(022) 555-0123',
    'finance@konveksimaju.com',
    'BCA',
    '883-098-7766',
    'PT. KONVEKSI MAJU JAYA'
where not exists (select 1 from public.company_profile);

-- Note: Sizes and Colors sorting is now handled by application constants (src/lib/constants.ts)

-- ============================================================
-- 6) COMPREHENSIVE MASTER DATA SEEDS (Consolidated from 0011)
-- ============================================================

-- Seed UoMs
INSERT INTO uoms (code, name, is_active) VALUES
('PCS', 'PCS', true),
('SET', 'SET', true),
('STEL', 'STEL', true),
('PAKET', 'PAKET', true)
ON CONFLICT (code) DO NOTHING;

-- Seed Colors
INSERT INTO colors (code, name, is_active) VALUES
('PUTIH', 'Putih', true),
('KUNING', 'Kuning', true),
('KUNING_T', 'Kuning .T', true),
('ORANGE', 'Orange', true),
('HIJAU', 'Hijau', true),
('BIRU', 'Biru', true),
('BIRU_TA', 'Biru T.A', true),
('BIRU_BCA', 'Biru Bca', true),
('BIRU_G', 'Biru. G', true),
('UNGU', 'Ungu', true),
('COKLAT', 'Coklat', true),
('HITAM', 'Hitam', true),
('BIRU_P', 'Biru.P', true)
ON CONFLICT (code) DO NOTHING;

-- Seed Sizes
INSERT INTO sizes (code, name, is_active) VALUES
('00', '00', true),
('0', '0', true),
('1', '1', true),
('1_5', '1,5', true),
('2', '2', true),
('2_5', '2,5', true),
('3', '3', true),
('3_5', '3,5', true),
('4', '4', true),
('4_5', '4,5', true),
('5', '5', true),
('5_5', '5,5', true),
('6', '6', true),
('6_5', '6,5', true),
('7', '7', true),
('7_5', '7,5', true),
('8', '8', true),
('8_5', '8,5', true),
('9', '9', true),
('9_5', '9,5', true),
('10', '10', true),
('11', '11', true),
('12', '12', true),
('13', '13', true),
('14', '14', true),
('15', '15', true),
('ALL', 'ALL', true),
('OS', 'OS', true),
('3S', '3S', true),
('2S', '2S', true),
('S', 'S', true),
('SM', 'SM', true),
('M', 'M', true),
('L', 'L', true),
('XL', 'XL', true),
('2XL', '2XL', true),
('3XL', '3XL', true),
('4XL', '4XL', true),
('5XL', '5XL', true)
ON CONFLICT (code) DO NOTHING;
