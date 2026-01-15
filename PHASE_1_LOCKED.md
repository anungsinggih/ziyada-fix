# PHASE 1 — Locked Scope Reference

Source documents: **.agent/rules/PHASE-1-SCOPE-PROJECT.md**, **.agent/rules/IMPLEMENTATION-CHECKLIST-PHASE-1.md**, and **.agent/rules/docs/ARCHITECTURE_LOCK.md** remain the single source of truth. Use this reference when making decisions.

## Scope Lock Summary

- **Roles**: Admin + Owner only. Nothing beyond those personas is touched this phase.
- **Status flow**: Every transaction must pass through `DRAFT → POSTED`. Anything `POSTED` is immutable.
- **Data gating**: Period lock triggers and role-based privileges block writes when a period is `CLOSED`.
- **Reporting**: All financial reports are read-only (Ledger, Trial Balance, P&L, Cashflow, AR / AP recaps).
- **Guardrails**:
  * No new modules outside Master Data, Sales, Purchase, Inventory, Receipt, Payment, Reporting, and Period Lock.
  * No free-entry receipts/payments.
  * No manual journal entries outside auto-generated journals per transaction.
  * No schema or RPC changes outside those explicitly requested in the checklist documents.

## In-Scope Modules (Phase 1)

Summaries below map to the checklist sections:

| Area | Key Points |
| --- | --- |
| **Master Data** | Items (SKU, price tiers), Customers, Vendors, COA, Opening Balance only. |
| **Sales** | Cash/Credit, automatic pricing per tier, DRAFT/POSTED lifecycle, auto receipt or AR. |
| **Purchase** | Cash/Credit, auto journals or AP, same draft/posted guard. |
| **Inventory** | Stock adjusts from purchases/sales, manual adjustments with validation/period lock. |
| **Receipt & Payment** | Always reference AR or AP. Petty cash capped at 500k. No standalone cash entries. |
| **Finance & Reports** | Auto journals for each transaction, reconciled reporting, period exports logged. |
| **Period Lock** | Flexible ranges, `OPEN`/`CLOSED`, prevents POSTS or edits when closed. |

## Out-of-Scope Reminders

The following explicitly remain outside Phase 1:

- Manufacturing BOM / costing / WIP
- Multi-warehouse / multi-currency / taxes automation
- Marketplace integrations / advanced approvals
- Ad-hoc journal creation or reports beyond the mandated list

Any request beyond this doc is a **change request**, not a bug fix—do not implement without explicit approval.
