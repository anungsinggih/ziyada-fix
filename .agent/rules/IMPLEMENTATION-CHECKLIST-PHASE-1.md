---
trigger: always_on
---

# .agent/rules/IMPLEMENTATION-CHECKLIST-PHASE-1.md

**Project**: ERP Dagang – Konveksi
**Phase**: 1 (MVP Internal ERP)
**Status**: Scope Locked

---

## 1. Prinsip Implementasi (WAJIB DIPATUHI)

* Ikuti **PHASE_1_SCOPE_PROJECT.md** dan **ARCHITECTURE_LOCK.md**
* **Tidak menambah fitur** di luar checklist ini
* Semua transaksi harus melewati **DRAFT → POSTED**
* Data `POSTED` **immutable**
* Semua laporan **read-only**

---

## 2. Environment & Setup

* [ ] Database schema (DDL) ter-apply tanpa error
* [ ] Enum & constraint aktif
* [ ] Trigger period lock aktif
* [ ] Role Admin & Owner terpasang
* [ ] User profile ter-sync dengan auth

---

## 3. Master Data

### Items

* [ ] CRUD item (SKU unik)
* [ ] Input tipe item (Barang Jadi / Bahan Baku)
* [ ] Input harga:

  * [ ] Price Umum
  * [ ] Price Khusus
* [ ] Validasi harga ≥ 0
* [ ] Bulk update harga

### Customer

* [ ] CRUD customer
* [ ] Set default price tier (Umum / Khusus)

### Vendor

* [ ] CRUD vendor

### COA

* [ ] CRUD akun
* [ ] Validasi kode akun unik
* [ ] Nonaktif akun (soft)

### Opening Balance

* [ ] Input neraca saldo awal
* [ ] Validasi debit = kredit
* [ ] Hanya bisa input sekali per akun & tanggal

---

## 4. Sales

### Transaksi

* [ ] Buat Sales (DRAFT)
* [ ] Tambah item:

  * [ ] Harga otomatis sesuai price tier customer
  * [ ] Simpan unit_price final di sales item
* [ ] Hitung subtotal & total
* [ ] POST Sales

### On POSTED

* [ ] Kurangi inventory
* [ ] Jika CASH:

  * [ ] Buat Receipt otomatis
  * [ ] Buat Journal
* [ ] Jika CREDIT:

  * [ ] Buat AR Invoice
  * [ ] Buat Journal

### Retur

* [ ] Buat Sales Return (DRAFT)
* [ ] POST Return:

  * [ ] Tambah inventory
  * [ ] Adjust journal
  * [ ] Adjust AR (jika ada)

---

## 5. Purchase

### Transaksi

* [ ] Buat Purchase (DRAFT)
* [ ] Tambah item (barang jadi / bahan baku)
* [ ] Hitung subtotal & total
* [ ] POST Purchase

### On POSTED

* [ ] Tambah inventory
* [ ] Jika CASH:

  * [ ] Buat Journal
* [ ] Jika CREDIT:

  * [ ] Buat AP Bill
  * [ ] Buat Journal

---

## 6. Inventory

* [ ] Stock bertambah dari Purchase POSTED
* [ ] Stock berkurang dari Sales POSTED
* [ ] Manual stock in (adjustment)
* [ ] Validasi stok tidak negatif
* [ ] Riwayat adjustment tersimpan

---

## 7. Receipt

* [ ] Receipt dari Sales CASH (auto)
* [ ] Receipt dari pelunasan AR
* [ ] Tidak bisa buat receipt tanpa referensi
* [ ] Update outstanding AR
* [ ] Validasi petty cash ≤ 500.000
* [ ] Buat Journal

---

## 8. Payment

* [ ] Payment dari Purchase CREDIT (AP)
* [ ] Tidak bisa buat payment tanpa referensi
* [ ] Update outstanding AP
* [ ] Buat Journal

---

## 9. Finance & Reporting

### Journal

* [ ] Journal tercipta untuk:

  * [ ] Sales
  * [ ] Purchase
  * [ ] Receipt
  * [ ] Payment
* [ ] Tidak ada journal manual entry

### Reports

* [ ] Buku Besar
* [ ] Neraca Saldo Awal
* [ ] Neraca Saldo Akhir
* [ ] Laba Rugi
* [ ] Cashflow
* [ ] Rekap AR per customer
* [ ] Rekap AP per vendor

---

## 10. Period Lock / Close

* [ ] Buat periode (start–end)
* [ ] Set status OPEN / CLOSED
* [ ] Saat CLOSED:

  * [ ] Tidak bisa POST transaksi
  * [ ] Tidak bisa ubah transaksi POSTED
  * [ ] Tidak bisa ubah Journal / Receipt / Payment
* [ ] Export laporan per periode
* [ ] Log export tersimpan

---

## 11. Validasi & Guardrails

* [ ] SKU unik
* [ ] COA code unik
* [ ] Tidak ada free entry Receipt / Payment
* [ ] Tidak ada perubahan data POSTED
* [ ] Period lock enforced di DB (trigger)

---

## 12. Testing Minimum (Wajib)

* [ ] Sales CASH end-to-end
* [ ] Sales CREDIT + pelunasan
* [ ] Purchase CASH end-to-end
* [ ] Purchase CREDIT + pembayaran
* [ ] Retur sales
* [ ] Period close & coba edit transaksi (harus gagal)
* [ ] Laporan reconcile dengan journal

---

## 13. Definition of Done – Phase 1

Phase 1 **SELESAI** jika:

* Semua checklist di atas **centang**
* Tidak ada fitur di luar scope
* Owner bisa menutup periode & export laporan
* Data konsisten tanpa koreksi manual

---

## 14. Scope Guard

Checklist ini adalah **batas implementasi Phase 1**.
Permintaan di luar daftar ini = **change request**, bukan bug.

---