# PHASE 1 — Feature Reference

This file distills the **must-have functionality** listed in `.agent/rules/PHASE-1-SCOPE-PROJECT.md` and `.agent/rules/IMPLEMENTATION-CHECKLIST-PHASE-1.md`. Use it as the quick reference when validating work or writing release notes.

## Master Data

- Items with SKU, type (Finished / Raw), and tiered pricing (Umum / Khusus).
- Customer and vendor profiles with basic contact data and default price tier.
- Chart of Accounts with CRUD and uniqueness guards.
- Opening Balance entry by owner only (balanced debit/credit, period-aware).

## Sales

- Sales are created as DRAFT, built from items using customer tier pricing.
- Line items store final `unit_price`, `qty`, `subtotal`, and `uom_snapshot`.
- POST step:
  * Deduct inventory.
  * Create Receipt (cash) or AR invoice (credit).
  * Generate Journal lines automatically.
- Sales returns follow the same DRAFT → POSTED lifecycle; they reverse inventory, AR, and COGS with preserved cost snapshots.

## Purchase

- Purchases follow the DRAFT → POSTED workflow.
- POSTed cash purchases auto-create journal entries; credit purchases create AP plus journal.
- Inventory increases by posted purchases for finished goods and raw materials.
- Purchase returns mirror sales returns: DRAFT → POST, reverse inventory, AP, and journal entries.

## Inventory

- Stock movement derived from posted purchases, sales, returns, and manual adjustments.
- Adjustments are period-aware and block when periods are closed.
- Guard against negative stock and keep adjustment history for audits.

## Receipt & Payment

- Receipts only tied to AR invoices; payments only tied to AP bills.
- Petty cash receipts are limited to `CASH` + ≤ 500.000 and appear with a badge in the UI.
- Auto-journal creation and AR/AP updates happen inside RPCs; no free-entry allowed.

## Finance & Reporting

- Journals auto-generated for every transaction (sales, purchase, receipt, payment).
- Reporting surface: Ledger, Trial Balance, Balance Sheet (initial/ending), Profit & Loss, Cashflow, AR/AP recaps.
- Export logs captured per period; all reports remain read-only.

## Period Lock

- Periods are date ranges marked OPEN/CLOSED.
- While `CLOSED`:
  * POST actions disallowed.
  * Existing posted data, journals, receipts, payments remain immutable.
  * Opening balances, adjustments, and returns respect the lock.

## Guardrails Checklist

1. DRAFT → POSTED enforced for all transaction flows.  
2. POSTED data is immutable via DB triggers.  
3. No new modules beyond the checklist (e.g., no complex approvals or manufacturing).  
4. UI/UX polish only for Phase 1 guardrail compliance—feature requests beyond scope are deferred.  
