# .agent/reference/TEMPLATE-SERVICE-LAYER-0004-rpc-posting-engine.md

---
trigger: always_on
---

Berikut **RPC Receipt AR + Payment AP** versi **real (PL/pgSQL atomic)** + **API route Next.js**. Polanya konsisten dengan RPC Sales/Purchase yang sudah saya buat: **service role memanggil RPC**, UI tidak menyentuh journal/AR/AP langsung.

---

## A) SQL: RPC `rpc_create_receipt_ar` + `rpc_create_payment_ap`

Tempel ke file migration baru, misal:
`/supabase/migrations/0005_rpc_receipt_payment.sql`

cek isi file supabase/migrations/0004_rpc_posting_engine.sql

---

## B) Next.js API Route (REAL)

### 1) `src/app/api/erp/receipt/ar/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/serverService";

const BodySchema = z.object({
  ar_invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  receipt_date: z.string().optional(), // "YYYY-MM-DD"
  method: z.string().optional(),

  cash_account_id: z.string().uuid(),
  ar_account_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const body = BodySchema.parse(await req.json());
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("rpc_create_receipt_ar", {
    p_ar_invoice_id: body.ar_invoice_id,
    p_amount: body.amount,
    p_receipt_date: body.receipt_date ?? null,
    p_method: body.method ?? "CASH",
    p_cash_account_id: body.cash_account_id,
    p_ar_account_id: body.ar_account_id,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json(data, { status: 200 });
}
```

### 2) `src/app/api/erp/payment/ap/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/serverService";

const BodySchema = z.object({
  ap_bill_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_date: z.string().optional(), // "YYYY-MM-DD"
  method: z.string().optional(),

  cash_account_id: z.string().uuid(),
  ap_account_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const body = BodySchema.parse(await req.json());
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("rpc_create_payment_ap", {
    p_ap_bill_id: body.ap_bill_id,
    p_amount: body.amount,
    p_payment_date: body.payment_date ?? null,
    p_method: body.method ?? "TRANSFER",
    p_cash_account_id: body.cash_account_id,
    p_ap_account_id: body.ap_account_id,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json(data, { status: 200 });
}
```

---

## C) Catatan penting (biar tidak bocor scope)

* RPC ini **menolak overpayment** (amount > outstanding) supaya AR/AP tidak jadi negatif.
* Period lock tetap enforced karena insert `receipts/payments/journals` akan diblok saat periode `CLOSED`.

---