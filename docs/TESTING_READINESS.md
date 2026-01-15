# Testing Readiness Checklist (T080–T088)

## 1. Scope Map
| Task ID | Description | Test Screen | Expected Result | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **T080** | No changes to POSTED data | Sales/Purchases List | Edit/Delete Blocked | DB Error "Cannot modify POSTED" |
| **T081** | Period Lock Enforced | Period Lock | Transactions Blocked | DB Error "Periode CLOSED" |
| **T082** | Sales CASH E2E | Sales Form | Status POSTED, Stock -1, Receipt Created | UI Status + Stock Card + GL (Cash) |
| **T083** | Sales CREDIT + Settlement | Sales Form / Finance | Sales POSTED, AR Created -> Paid | UI AR List + Receipt Created |
| **T084** | Purchase CASH E2E | Purchase Form | Status POSTED, Stock +1, Payment | UI Status + Stock Card + GL (Cash) |
| **T085** | Purchase CREDIT + Payment | Purchase Form / Finance | Purchase POSTED, AP Created -> Paid | UI AP List + Payment Created |
| **T086** | Sales Return | Sales Return Form | Status POSTED, Stock +1, AR/Cash Rev | UI Status + Stock Card + GL |
| **T087** | Test Period Lock | Period Lock / Sales | "Close Period" -> Try Post -> Fail | Error Alert on Screen |
| **T088** | Reports Reconcile | Reporting (GL/TB) | Dr = Cr, Balances Match | Reports Display Data |

## 2. Infrastructure
- **Auth**: ✅ Implemented (Migration 013). User = OWNER.
- **DB Enforcement**: ✅ Validated (Migration 0001 Triggers + 014 Hardening).
- **UI Wiring**: ✅ Validated (Lists, Forms, RPC Calls).
