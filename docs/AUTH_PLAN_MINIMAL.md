# AUTH PLAN MINIMAL (Phase 1)

## 1. Overview
Authentication uses Supabase Auth (Email/Password) combined with a `user_profiles` table for Role-Based Access Control (RBAC).
- **Scope**: Phase 1 (Locked).
- **Roles**: `OWNER` (Full Access), `ADMIN` (Restricted: Sales/Inventory).

## 2. Role Management Mechanisms
### A. Bootstrap (Preferred)
- **Mechanism**: Database Trigger (`on_auth_user_created`).
- **Implementation**: `013_auth_handle.sql`.
- **Logic**: 
  - When a new user Signs Up (via `Login.tsx`), the trigger fires.
  - A corresponding row is inserted into `public.user_profiles`.
  - **Default Role**: `OWNER` (For MVP simplification, enabling immediate testing).

### B. Access Control (RLS)
- **Policy Enforcement**: `0003_policies_minimal.sql`.
- **Logic**:
  - `user_profiles.role` is checked via `current_app_role()` helper function.
  - `is_owner()` and `is_admin()` wrappers determine access.
  - Tables like `accounts`, `period_exports` are restricted to `OWNER`.
  - Operational tables (`sales`, `items`) are accessible to `ADMIN`.

## 3. Testing Flow
1. **User Sign Up**: Use the Login Screen.
2. **Auto-Profile**: System creates profile `OWNER`.
3. **Session**: User is authenticated; RLS policies grant access.
4. **Verification**: Check `user_profiles` table (via Supabase dashboard or query) to confirm role.

## 4. Security Note
- **MVP Risk**: Defaulting to `OWNER` is permissive. In Production, default should be `NONE` or `STAFF`, with manual promotion to `OWNER`.
- **Mitigation**: Local/Staging environment only.

## 5. UI Requirements
- Login Screen (Email/Pass).
- Sign Out Button.
- Session Persistence (Supabase Client).
