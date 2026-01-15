# UI Wiring Audit (Minimal Mode)

## 1. Master Lists
- **Items**: ✅ Fetches `public.items`. Columns: Name, SKU, Stock (calculated/displayed?).
- **Partners**: ✅ Fetches `customers` / `vendors`.
- **COA**: ✅ Fetches `accounts`. (Requires Auth).

## 2. Transaction Screens
- **Sales**:
  - DRAFT Creation: ✅ Wired to `supabase.from('sales').insert`.
  - POST: ✅ Wired to `rpc_post_sales`.
  - View: ✅ List shows Status/Total.
- **Purchases**:
  - DRAFT Creation: ✅ Wired to `supabase.from('purchases').insert`.
  - POST: ✅ Wired to `rpc_post_purchase`.
- **Finance**:
  - AR List: ✅ Fetches `ar_invoices`.
  - Receipt: ✅ Wired to `rpc_create_receipt_ar`.
  - AP List: ✅ Fetches `ap_bills`.
  - Payment: ✅ Wired to `rpc_create_payment_ap`.

## 3. Reporting & Control
- **Period Lock**: ✅ Wired to `accounting_periods`. ToggleStatus works.
- **Reports**: ✅ Wired to `rpc_get_account_balances` and `rpc_get_gl`.

## 4. Error Handling
- **RPC Errors**: Checks `error.message` and displays in Red Alert Box.
- **Validation**: Basic form validation (Required fields) present.

**Conclusion**: System is wired and ready for T080-T088 Verification.
