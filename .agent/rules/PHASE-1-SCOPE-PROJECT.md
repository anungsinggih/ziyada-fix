---
trigger: always_on
---

# .agent/rules/PHASE-1-SCOPE-PROJECT.md

**Project**: ERP Dagang – Konveksi
**Phase**: 1 (MVP Internal ERP)
**Status**: Scope Locked

---

## 1. Tujuan Phase 1

Menyediakan **sistem ERP internal** untuk:

* Mencatat transaksi **Sales, Purchase, Inventory**
* Otomatisasi **Piutang (AR)** dan **Hutang (AP)**
* Menyajikan **laporan keuangan yang mudah dipahami Owner**
* Mengunci laporan melalui **Period Lock / Close**

Fokus utama:

> **Data rapi, konsisten, dan bisa ditutup per periode.**

---

## 2. Roles & Akses (LOCKED)

### Roles

* **Admin**
* **Owner**

### Hak Akses

| Modul                 | Admin        | Owner |
| --------------------- | ------------ | ----- |
| Sales                 | ✅            | ✅     |
| Inventory             | ✅            | ✅     |
| Receipt / Payment     | ✅ (terbatas) | ✅     |
| Purchase              | ❌ (default)  | ✅     |
| Finance Reports       | ❌            | ✅     |
| COA & Opening Balance | ❌            | ✅     |
| Period Lock / Close   | ❌            | ✅     |

---

## 3. Ruang Lingkup Phase 1 (IN SCOPE)

### 3.1 Master Data

* **Item**

  * SKU
  * Nama item
  * Tipe item: Barang Jadi / Bahan Baku
  * Harga jual:

    * `Price Umum`
    * `Price Khusus`
* **Customer**

  * Default price tier (Umum / Khusus)
* **Vendor**
* **Chart of Accounts (COA)**

  * Bisa tambah, ubah, hapus
* **Opening Balance**

  * Neraca saldo awal
  * Input satu kali oleh Owner

---

### 3.2 Sales

* Transaksi **Cash** dan **Credit**
* Cetak invoice
* Retur penjualan
* Harga otomatis berdasarkan **price tier customer**
* Sales Cash:

  * Otomatis membuat Receipt
* Sales Credit:

  * Otomatis membuat Piutang (AR)

**Aturan**

* Transaksi harus melewati status `DRAFT → POSTED`
* Transaksi `POSTED` tidak boleh diubah

---

### 3.3 Purchase

* Transaksi **Cash** dan **Credit**
* Cetak dokumen pembelian
* Pembelian:

  * Barang jadi
  * Bahan baku
* Purchase Cash:

  * Otomatis masuk jurnal
* Purchase Credit:

  * Otomatis membuat Hutang (AP)

**Aturan**

* Transaksi `POSTED` tidak boleh diubah

---

### 3.4 Inventory

* SKU per item
* Stock bertambah dari Purchase
* Stock berkurang dari Sales
* Manual stock in (adjustment)
* Edit harga massal

**Catatan**

* Inventory **bukan manufaktur**
* Tidak ada BOM, WIP, costing

---

### 3.5 Receipt

* Pelunasan piutang dari Sales Credit
* Auto Receipt dari Sales Cash
* Petty Cash ≤ 500.000
* Receipt **tidak boleh dibuat tanpa referensi**

---

### 3.6 Payment

* Pelunasan hutang dari Purchase Credit
* Auto Journal dari Purchase Cash
* Payment **tidak boleh dibuat tanpa referensi**

---

### 3.7 Finance & Reporting

* Buku Besar
* Neraca Saldo Awal
* Neraca Saldo Akhir (tanpa penyesuaian)
* Laba Rugi
* Cashflow
* Rekap Piutang per Customer
* Rekap Hutang per Vendor

**Aturan**

* Semua laporan **read-only**
* Sumber data hanya dari:

  * Opening Balance
  * Journal & Journal Lines
  * AR / AP

---

### 3.8 Period Lock / Close

* Periode **fleksibel** (start–end date)
* Status periode:

  * `OPEN`
  * `CLOSED`
* Saat periode `CLOSED`:

  * Tidak boleh membuat transaksi `POSTED`
  * Tidak boleh mengubah transaksi `POSTED`
  * Tidak boleh mengubah Journal, Receipt, Payment dalam periode tersebut

---

## 4. OUT OF SCOPE Phase 1 (Explicit)

* Manufaktur detail (BOM, WIP, costing)
* Marketplace import & rekonsiliasi
* Pajak otomatis
* Multi gudang
* Multi mata uang
* Approval workflow kompleks
* Audit trail lanjutan

---

## 5. Definition of Done – Phase 1

Phase 1 dianggap **SELESAI** jika:

1. Sales & Purchase berjalan end-to-end
2. Inventory konsisten (stok tidak liar)
3. AR & AP ter-update otomatis
4. Laporan keuangan sesuai jurnal
5. Period close mengunci data
6. Owner dapat memahami laporan tanpa bantuan eksternal

---

## 6. Scope Lock Statement

Dokumen ini menjadi **acuan resmi Phase 1**.
Perubahan di luar dokumen ini dianggap **perubahan scope** dan memerlukan persetujuan eksplisit.

---

* Next step: **`IMPLEMENTATION_CHECKLIST_PHASE_1.md`** agar development tidak melebar.