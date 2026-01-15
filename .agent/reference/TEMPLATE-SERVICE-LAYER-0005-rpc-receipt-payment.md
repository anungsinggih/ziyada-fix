# .agent/reference/TEMPLATE-SERVICE-LAYER-005-rpc-receipt-payment.md

---
trigger: always_on
---


Di bawah ini saya berikan template **pseudo → real code** untuk 4 flow utama (Sales POST, Purchase POST, Receipt AR, Payment AP). Ini **sesuai ARCHITECTURE_LOCK.md**: posting contract dikerjakan di service layer/RPC, UI hanya trigger.

> Asumsi eksplisit: Anda pakai Next.js 15 + supabase-js, dan server punya `SUPABASE_SERVICE_ROLE_KEY`.
> Fakta: supabase-js **tidak** punya “BEGIN/COMMIT” multi statement secara native, jadi RPC adalah cara clean.

---

## 1) Struktur File (disarankan)

```
/supabase/migrations
  0004_rpc_posting_engine.sql   <-- RPC functions (atomic transactions)

/src/lib/supabase
  serverService.ts              <-- supabase client pakai service role

/src/app/api/erp
  sales/post/route.ts
  purchase/post/route.ts
  receipt/ar/route.ts
  payment/ap/route.ts
```

---

## 2) `0004_rpc_posting_engine.sql` (REAL, Atomic)

> Ini contoh minimal: **POST Sales** dan **POST Purchase** plus helper update stock & create journal.
> Journal lines saya buat “placeholder minimal” (2 line) karena mapping COA Anda belum didefinisikan detail (dan Anda sebelumnya melarang improve). Anda tinggal ganti account_id sesuai COA Anda.

cek supabase/migrations/0004_rpc_posting_engine.sql

> Catatan: Trigger **period lock** tetap bekerja karena update `sales.status`/`purchase.status` dan insert journals/receipts/payments akan diblok jika tanggal masuk periode CLOSED.

---

## 3) Supabase Service Client (REAL TypeScript)

`src/lib/supabase/serverService.ts`

```ts
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

---

## 4) API Route: POST Sales (REAL)

`src/app/api/erp/sales/post/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/serverService";

const BodySchema = z.object({
  sales_id: z.string().uuid(),
  cash_account_id: z.string().uuid(),
  ar_account_id: z.string().uuid(),
  sales_account_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const body = BodySchema.parse(await req.json());
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("rpc_post_sales", {
    p_sales_id: body.sales_id,
    p_cash_account_id: body.cash_account_id,
    p_ar_account_id: body.ar_account_id,
    p_sales_account_id: body.sales_account_id,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data, { status: 200 });
}
```

---

## 5) API Route: POST Purchase (REAL)

`src/app/api/erp/purchase/post/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/serverService";

const BodySchema = z.object({
  purchase_id: z.string().uuid(),
  cash_account_id: z.string().uuid(),
  ap_account_id: z.string().uuid(),
  inventory_account_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const body = BodySchema.parse(await req.json());
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("rpc_post_purchase", {
    p_purchase_id: body.purchase_id,
    p_cash_account_id: body.cash_account_id,
    p_ap_account_id: body.ap_account_id,
    p_inventory_account_id: body.inventory_account_id,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data, { status: 200 });
}
```

Contoh aturan service-layer:
on “Add line item”:
fetch item → uom_snapshot = item.uom

---

## 6) Receipt AR & Payment AP (Template singkat)

Karena di Phase 1 Anda sudah punya tabel `receipts/payments` dan `ar_invoices/ap_bills`, polanya sama: RPC atomic.

### RPC Receipt AR (minimal)

* insert receipt
* update `ar_invoices.outstanding_amount`
* create journal

### RPC Payment AP (minimal)

* insert payment
* update `ap_bills.outstanding_amount`
* create journal

Kalau Anda mau, saya bisa tuliskan **SQL RPC + route** lengkapnya seperti Sales/Purchase (tinggal 2 function lagi).

---

## 7) Kenapa ini “siap orchestration”

* **Atomic**: stock + status + journal + AR/AP/receipt terjadi dalam 1 transaksi DB
* **RLS aman**: service role memanggil RPC, UI tidak bisa “nulis jurnal”
* **Period lock enforced**: trigger di DB akan menolak saat CLOSED

---