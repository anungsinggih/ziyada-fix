---
trigger: always_on
---

# .agent/rules/docs/COA-MAPPING-MINIMAL.md

Project: ERP Dagang – Konveksi  
Phase: 1 (MVP Internal ERP)  
Status: LOCKED (Konvensi Implementasi)

Dokumen ini mendefinisikan **mapping akun COA minimal** yang **WAJIB dipakai** oleh:
- RPC posting engine
- Service layer
- AI orchestration

Dokumen ini **bukan fitur baru**, hanya **konvensi tetap** agar tidak terjadi inkonsistensi journal.

---

## 1) Prinsip Umum
- Mapping ini **bersifat hard convention**
- Jika ingin mengganti akun → **ubah mapping ini dulu**
- Journal & laporan **tidak boleh mengira-ngira akun**

---

## 2) COA Mapping (Minimal)

### Asset
| Fungsi | Kode Akun | Nama Akun |
|------|----------|-----------|
| Cash / Bank | **1100** | Kas |
| Accounts Receivable (AR) | **1200** | Piutang Usaha |
| Inventory (Barang Jadi + Bahan Baku) | **1300** | Persediaan |

> Catatan: Phase 1 **tidak membedakan** inventory FG/RM di journal.

---

### Liability
| Fungsi | Kode Akun | Nama Akun |
|------|----------|-----------|
| Accounts Payable (AP) | **2100** | Hutang Usaha |

---

### Revenue
| Fungsi | Kode Akun | Nama Akun |
|------|----------|-----------|
| Sales Revenue | **4100** | Penjualan |

---

### Expense / COGS
| Fungsi | Kode Akun | Nama Akun |
|------|----------|-----------|
| Cost of Goods Sold (HPP) | **5100** | Harga Pokok Penjualan |

> Catatan: Phase 1 **tidak menghitung HPP otomatis**.  
> Akun ini **belum digunakan** oleh RPC, disiapkan untuk konsistensi laporan.

---

## 3) Mapping ke Posting Contract

### Sales CASH
```

Dr 1100 (Kas)
Cr 4100 (Penjualan)

```

### Sales CREDIT
```

Dr 1200 (Piutang Usaha)
Cr 4100 (Penjualan)

```

### Receipt AR
```

Dr 1100 (Kas)
Cr 1200 (Piutang Usaha)

```

---

### Purchase CASH
```

Dr 1300 (Persediaan)
Cr 1100 (Kas)

```

### Purchase CREDIT
```

Dr 1300 (Persediaan)
Cr 2100 (Hutang Usaha)

```

### Payment AP
```

Dr 2100 (Hutang Usaha)
Cr 1100 (Kas)

```

---

## 4) Aturan Implementasi (WAJIB)
1. RPC **tidak boleh hardcode account_id**
2. Service layer:
   - resolve `account_id` dari `accounts.code`
   - berdasarkan mapping di dokumen ini
3. UI:
   - tidak memilih akun
   - tidak mengirim `account_id`

---

## 5) Definition of Done (Mapping)
Mapping dianggap **final & locked** jika:
- Kode akun di `0002_seed_minimal.sql` sesuai dokumen ini
- RPC berhasil membuat journal tanpa error mapping
- Tidak ada journal yang memakai akun di luar daftar ini

---

## 6) Scope Guard
Perubahan pada file ini:
- **tidak** menambah fitur
- **boleh** dilakukan kapan saja
- **WAJIB** di-review sebelum coding

---

End of document.
```