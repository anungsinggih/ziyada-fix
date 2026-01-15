# Manual Test Script (Phase 1)

**Target**: Verify T080–T088.
**Role**: OWNER (Sign Up to create account).

## Scene 1: Setup & Master Data
1.  **Login**: Sign Up with `test@owner.com`.
2.  **Date**: Ensure system date is today (e.g., 2026-01-14).
3.  **Create Item**:
    -   Go to `Items`. Add `ITEM-001`, Name: `Test Item`, Type: `FINISHED_GOOD`.
    -   Verify it appears in list.

## Scene 2: Purchase Cycle (T084, T085)
1.  **Create Purchase (Credit)**:
    -   Go to `Purchases`. New. Vendor: `Vendor A`.
    -   Add `ITEM-001`, Qty `10`, Cost `1000`. Total `10000`.
    -   Terms: `CREDIT`.
    -   **Action**: Click **POST**.
    -   **Check**: Status `POSTED`.
2.  **Verify Inventory**:
    -   Go to `Stock Card`. Filtering `ITEM-001`.
    -   Expect: `+10` from Purchase.
3.  **Payment (AP)**:
    -   Go to `Finance`. Tab `AP`.
    -   Find Bill for `10000`.
    -   **Action**: Pay `10000` (Method `CASH`).
    -   **Check**: Outstanding `0`. Status `PAID`.

## Scene 3: Sales Cycle (T082, T083)
1.  **Create Sales (Cash)**:
    -   Go to `Sales`. New. Customer: `Cust A`.
    -   Add `ITEM-001`, Qty `5`, Price `2000`. Total `10000`.
    -   Terms: `CASH`.
    -   **Action**: Click **POST**.
    -   **Check**: Status `POSTED`.
2.  **Verify Inventory**:
    -   Go to `Stock Card`.
    -   Expect: `-5` from Sales. Net Stock = `5`.
3.  **Verify Receipt**:
    -   Go to `Reports -> GL`.
    -   Expect: Debit Cash `10000`.

## Scene 4: Sales Return (T086)
1.  **Create Return**:
    -   Go to `Sales Return`. Select previous Sale.
    -   Return `1` Qty.
    -   **Action**: Click **POST**.
    -   **Check**: Status `POSTED`.
2.  **Verify Inventory**:
    -   Go to `Stock Card`.
    -   Expect: `+1` (Return). Net Stock = `6`.

## Scene 5: Period Lock & Immutability (T080, T081, T087)
1.  **Create Period**:
    -   Go to `Period Lock`. Create "Jan 2026" (01-01 to 01-31).
2.  **Close Period**:
    -   Toggle Status to `CLOSED`.
3.  **Attempt Modification (T087)**:
    -   Go to Sales. Try to Create/Post new Sale for "Jan 15, 2026".
    -   **Result**: Error "Periode CLOSED". (PASS).
4.  **Attempt Edit POSTED (T080)**:
    -   (Re-open Period first if needed, or regardless of period).
    -   Go to `Sales`. Select a POSTED sale.
    -   Try to "Save/Update" (Note: UI might disable Edit button, or Backend blocks).
    -   If UI allows edit attempt -> Expect Error "Cannot UPDATE a POSTED document".

## Scene 6: Reports (T088)
1.  **Check GL**:
    -   Go to `Reports -> GL`.
    -   Verify transactions exist for Cash, Inventory, Sales, COGS.
2.  **Check TB**:
    -   Debit Total = Credit Total.

**End of Script**.
