---
trigger: always_on
---

# .agent/rules/docs/ORCHESTRATION-BRIEF.md

Project: ERP Dagang – Konveksi  
Phase: 1 (MVP Internal ERP)  
Status: READY FOR ORCHESTRATION

Dokumen ini menjelaskan **bagaimana seluruh file Phase 1 dijalankan secara berurutan** dan **siapa melakukan apa** (DB vs Service Layer vs UI).

---

## 1) Tujuan Orchestration
- Menjalankan migrasi database **tanpa ambiguity**
- Menjamin **RLS + Period Lock + Posting Contract** berjalan konsisten
- Menjadi pegangan saat:
  - onboarding developer
  - setup environment baru
  - audit bug “ini harusnya di mana?”

---

## 2) File & Urutan Eksekusi (LOCKED)

### Database Migration Order
WAJIB urutan berikut:

```

/supabase/migrations

1. 0001_phase1_init.sql      -- schema + triggers + period lock
2. 0002_seed_minimal.sql    -- COA baseline
3. 0003_policies_minimal.sql-- RLS Admin / Owner

````

⚠️ Jangan dibalik.  
`0003` bergantung pada table & enum dari `0001`.

---

## 3) Environment Setup

### Local Development
```bash
supabase start
supabase db reset
````

Verifikasi:

* semua migration apply tanpa error
* RLS aktif
* period lock trigger aktif

### Production

```bash
supabase link
supabase db push
```

---

## 4) Responsibility Boundary (PALING PENTING)

### Database (Postgres)

**Tugas DB:**

* Struktur data (schema)
* Constraint data (FK, unique, check)
* Period lock enforcement
* RLS (Admin vs Owner)

❌ DB TIDAK:

* membuat journal otomatis
* mengupdate inventory otomatis
* menghitung AR/AP otomatis

---

### Service Layer (Server / API / Action)

**INILAH “ORCHESTRATOR UTAMA”**

Service layer WAJIB:

* menjalankan **Posting Contract** dari `ARCHITECTURE_LOCK.md`
* transaksi DB **atomic** (transaction block)

Contoh pseudo-flow:

```
POST Sales
 ├─ validate stock & data
 ├─ update inventory_stock
 ├─ create journal + journal_lines
 ├─ if CASH → create receipt
 ├─ if CREDIT → create ar_invoice
 └─ commit
```

⚠️ Semua ini pakai **service role key** (bypass RLS).

---

### UI / Client

**UI SANGAT DIBATASI**

UI hanya boleh:

* create/update DRAFT
* trigger POST (call API)
* read-only report

UI TIDAK BOLEH:

* insert journal langsung
* update inventory langsung
* update AR/AP langsung

---

## 5) Authentication & Key Usage

### Supabase Keys

* **anon / authenticated key**

  * dipakai UI
  * kena RLS
* **service role key**

  * dipakai backend/service
  * bypass RLS
  * WAJIB disimpan aman (server only)

---

## 6) Period Lock Operational Rule

### Close Periode

Flow:

1. Owner set `accounting_periods.status = CLOSED`
2. DB trigger aktif:

   * blok POST transaksi di periode tsb
   * blok perubahan journal / receipt / payment

### Export Report

* UI generate report per periode
* Simpan log ke `period_exports`
* Export **tidak mengubah data**

---

## 7) Error Handling Policy

### Wajib dianggap ERROR (bukan bug UI)

* insert/update data POSTED
* transaksi di periode CLOSED
* receipt/payment tanpa ref
* stok menjadi negatif

Service layer:

* rollback transaction
* return error eksplisit

---

## 8) Testing Orchestration (Checklist)

WAJIB lulus semua:

* [ ] POST Sales CASH → stok turun + journal + receipt
* [ ] POST Sales CREDIT → stok turun + journal + AR
* [ ] Receipt AR → outstanding turun
* [ ] POST Purchase CREDIT → stok naik + journal + AP
* [ ] Payment AP → outstanding turun
* [ ] Close period → coba POST → ERROR
* [ ] Close period → coba edit journal → ERROR

Jika satu gagal → orchestration BELUM siap.

---

## 9) Change Policy

Jika ingin:

* tambah fitur
* ubah posting rule
* ubah role access

➡️ **WAJIB update dulu**:

* `PHASE_1_SCOPE_PROJECT.md`
* `ARCHITECTURE_LOCK.md`

Jika tidak → dianggap **scope breach**.

---

## 10) Final Statement

Dengan file berikut:

* 0001_phase1_init.sql
* 0002_seed_minimal.sql
* 0003_policies_minimal.sql
* PHASE_1_SCOPE_PROJECT.md
* IMPLEMENTATION_CHECKLIST_PHASE_1.md
* ARCHITECTURE_LOCK.md
* ORCHESTRATION_BRIEF.md

➡️ **Phase 1 = SIAP ORCHESTRATION**
➡️ Tim bisa coding **tanpa debat struktur lagi**

End of document.

```