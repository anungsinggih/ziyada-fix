---
trigger: always_on
---

# .agent/rules/ARCHITECTURE-LOCK.md

Project: ERP Dagang – Konveksi  
Phase: 1 (MVP Internal ERP)  
Status: ARCHITECTURE LOCKED

Dokumen ini adalah **kontrak arsitektur** untuk Phase 1.  
Tujuannya: mencegah interpretasi berbeda saat implementasi (service layer / UI / DB).

---

## 1) Scope Lock (Ringkas)
**In Scope Phase 1**
- Master Data: Items (SKU), Customers, Vendors, COA, Opening Balance
- Sales: Cash/Credit, Print Invoice, Return
- Purchase: Cash/Credit, Print Purchase Doc
- Inventory: Stock on hand, bulk price update, manual stock in (adjustment)
- Receipt: auto dari Sales CASH + pelunasan AR + petty cash ≤ 500.000
- Payment: pelunasan AP
- Finance Reports: GL, Trial Balance (awal/akhir), P&L, Cashflow, AR/AP summary
- Period Lock/Close: periode fleksibel, status OPEN/CLOSED, export log

**Out of Scope Phase 1**
- Manufaktur detail (BOM/WIP/costing/upah)
- Marketplace import & rekonsiliasi
- Tax engine
- Multi-warehouse, multi-currency
- Approval workflow kompleks
- Event engine / replay / rebuild

---

## 2) Roles & Permissions (Locked)
- **Admin**: Sales, Inventory, Receipt/Payment (terbatas), Master data operasional
- **Owner**: Full, termasuk COA, Opening Balance, Finance Reports, Period Lock

Catatan: Purchase default **Owner only** (sesuai scope lock). Jika diubah, itu perubahan scope/policy.

---

## 3) Status Model (DRAFT / POSTED / VOID)
Semua dokumen transaksi utama (Sales, Purchase, Sales Return) wajib mengikuti:

- **DRAFT**
  - boleh edit header & line
  - boleh delete (soft delete direkomendasikan)
- **POSTED**
  - **IMMUTABLE**: tidak boleh ubah content bisnis (tanggal, item, qty, amount, terms, customer/vendor)
  - hanya boleh berubah status menjadi VOID via mekanisme yang disetujui
- **VOID**
  - dokumen dibatalkan
  - efek operasional/finance harus dibalik melalui mekanisme void/return (di service layer)

---

## 4) Posting Contract (Kontrak Implementasi Wajib)
Ini kontrak yang harus diimplementasikan di service layer.

### 4.1 Sales Posting Contract
**Input**: `sales`, `sales_items`  
**On POSTED**:
1. Inventory:
   - `inventory_stock.qty_on_hand -= qty` per item
2. Finance:
   - selalu buat `journals` + `journal_lines`
3. Cash/Credit:
   - jika `terms=CASH` → auto create `receipts` (source=`SALES_CASH`)
   - jika `terms=CREDIT` → create `ar_invoices` (outstanding=total)

**Immutable setelah POSTED**:
- `sales` (selain `status`)
- `sales_items`

### 4.2 Sales Return Posting Contract (Minimal)
**Input**: `sales_returns`, `sales_return_items`  
**On POSTED**:
1. Inventory:
   - `inventory_stock.qty_on_hand += qty` per item
2. Finance:
   - buat journal reversal sesuai total return (minimal)
3. AR:
   - jika sales awal CREDIT dan ada `ar_invoices`:
     - `outstanding_amount = max(0, outstanding_amount - return_total)`
     - status update: `PAID` bila outstanding 0, else `PARTIAL`

**Immutable setelah POSTED**:
- return header & lines

### 4.3 Purchase Posting Contract
**Input**: `purchases`, `purchase_items`  
**On POSTED**:
1. Inventory:
   - `inventory_stock.qty_on_hand += qty` per item
2. Finance:
   - selalu buat `journals` + `journal_lines`
3. Cash/Credit:
   - jika `terms=CASH` → tidak perlu AP
   - jika `terms=CREDIT` → create `ap_bills` (outstanding=total)

**Immutable setelah POSTED**:
- `purchases` (selain `status`)
- `purchase_items`

### 4.4 Receipt Contract (Anti Free Entry)
**Input**: `receipts`
- receipt **tidak boleh free entry**
- `ref_type` + `ref_id` wajib menunjuk salah satu:
  - `sales` (cash)
  - `ar_invoices` (pelunasan)

**On create (atau posting)**:
1. Jika `ref_type='ar_invoice'`:
   - `ar_invoices.outstanding_amount = max(0, outstanding - amount)`
   - status update: `PAID` bila 0, else `PARTIAL`
2. Finance:
   - buat journal untuk receipt

**Petty cash rule**:
- `is_petty_cash=true` → `amount <= 500000` (DB constraint)

### 4.5 Payment Contract (Anti Free Entry)
**Input**: `payments`
- payment **tidak boleh free entry**
- `ref_type` + `ref_id` wajib menunjuk:
  - `ap_bills` (pelunasan hutang) atau purchase cash (jika dipakai sebagai referensi)

**On create (atau posting)**:
1. Jika `ref_type='ap_bill'`:
   - `ap_bills.outstanding_amount = max(0, outstanding - amount)`
   - status update: `PAID` bila 0, else `PARTIAL`
2. Finance:
   - buat journal untuk payment

---

## 5) Source of Truth Rules (Agar Data Tidak Konflik)
### 5.1 Inventory
- `inventory_stock.qty_on_hand` adalah nilai operasional resmi.
- Sumber perubahan stok:
  - Sales POSTED (minus)
  - Sales Return POSTED (plus)
  - Purchase POSTED (plus)
  - Manual adjustment (delta)

### 5.2 AR/AP Outstanding
- `ar_invoices.outstanding_amount` adalah nilai resmi outstanding.
- Pengurang outstanding: `receipts` yang merefer ke AR.
- `ap_bills.outstanding_amount` adalah nilai resmi outstanding.
- Pengurang outstanding: `payments` yang merefer ke AP.

### 5.3 Finance Reporting
- Semua report finance berasal dari:
  - `opening_balances` (saldo awal)
  - `journals` + `journal_lines` (mutasi)
- Tidak boleh mengambil angka langsung dari `sales.total_amount` untuk laporan finance tanpa jurnal.

---

## 6) Price Tiering (Umum / Khusus) - Locked
- `customers.price_tier` menentukan harga default pada sales.
- `sales_items.unit_price` menyimpan harga final (immutable setelah POSTED).
- `sales_items.price_tier_applied` wajib disimpan untuk audit.

---

## 7) Period Lock / Close (Database Enforced)
- Periode fleksibel: `accounting_periods(start_date, end_date)`
- Status:
  - `OPEN` → transaksi bisa diposting
  - `CLOSED` → database memblok perubahan sesuai aturan

**Rule saat CLOSED**:
- Tidak boleh membuat/ubah dokumen menjadi POSTED pada tanggal dalam periode CLOSED:
  - `sales.sales_date`, `purchases.purchase_date`, `sales_returns.return_date`
- Tidak boleh insert/update/delete:
  - `journals`, `receipts`, `payments` pada tanggal dalam periode CLOSED

Catatan: enforcement dilakukan via triggers di migration `0001_phase1_init.sql`.

---

## 8) Immutability Rules (Locked)
- Semua dokumen `POSTED` adalah immutable.
- Perubahan business effect dilakukan dengan:
  - Sales Return (untuk sales)
  - VOID (bila diimplementasikan) dengan reversal yang jelas

---

## 9) Non-Goals (Untuk mencegah scope creep)
Tidak akan dibangun pada Phase 1:
- pembukuan penyesuaian, accrual, closing entries
- audit log enterprise
- remap COA historis
- perhitungan HPP kompleks / costing method
- marketplace

---

## 10) Architecture Closed Criteria
Arsitektur Phase 1 dianggap **CLOSED** bila:
1. Schema `0001` apply tanpa error
2. Seed `0002` apply tanpa error
3. Policies `0003` apply tanpa error
4. Dokumen ini dipakai sebagai kontrak implementasi (tidak ada interpretasi baru di luar ini)

---

## 11) Implementation Ownership
- Database: definisi schema, constraints, triggers period lock
- Service layer: implement posting contract, auto AR/AP, auto journal, update inventory
- UI: hanya membuat DRAFT, memicu POST, menampilkan laporan read-only

End of document.