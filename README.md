# Ziyada ERP — Phase 1 (ERP Dagang Konveksi)

Internal ERP for the Konveksi business: sales, purchases, inventory, and finance (AR/AP). Phase 1 is *locked scope*—refer to `.agent/rules/PHASE-1-SCOPE-PROJECT.md` and `.agent/rules/IMPLEMENTATION-CHECKLIST-PHASE-1.md` before adding anything new.

## Highlights

- **Tech**: Vite + React + TypeScript front-end, Supabase/Postgres backend with SQL migrations and RPCs under `supabase/`.
- **Guardrails**:
  * Admin + Owner only.
  * Transactions flow through `DRAFT → POSTED`; `POSTED` rows become immutable.
  * Period lock enforces write-blocks when a period is `CLOSED`.
  * No free-entry receipts/payments or manual journals.
- **Focus areas**: Master data, Sales, Purchases, Inventory adjustments, Receipts/Payments, Finance reporting, Period locking.

## Getting started

```bash
npm install
npm run dev
```

Supabase migrations live under `supabase/migrations`. Follow the order in the `.agent` rule documents before touching production data.

## Documentation

- `PHASE_1_LOCKED.md`: concise scope lock summary (new).
- `PHASE_1_FEATURES.md`: feature checklist derived from the official phase documentation (new).
- `.agent/rules/PHASE-1-SCOPE-PROJECT.md`: primary scope statement.
- `.agent/rules/IMPLEMENTATION-CHECKLIST-PHASE-1.md`: detailed checklist and guardrails.
- `.agent/rules/docs/ARCHITECTURE_LOCK.md`: infrastructure & architectural constraints.

## Manual checks

Before closing Phase 1 work, complete these:

1. Sales & Purchase flows operate end-to-end (draft to posted).
2. Inventory adjusts correctly from purchases/sales/returns.
3. Receipts/payments update AR/AP (petty cash capped at IDR 500k).
4. Financial reporting derives exclusively from journals + AR/AP data.
5. Period closing prevents posts/edits and logs exports.

Phase 1 is done when the owner can close a period and all reports remain reconciled without extra adjustments.
