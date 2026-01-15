-- ============================================================
-- 0006_phase1_consolidated_hardening.sql
-- PHASE 1 HARDENING & UTILITIES (Consolidated)
-- Merges: 006 (Immutability), 007 (OB Lock), 014 (Hardening), 016 (Reset), 019 (System Accounts)
-- ============================================================

set search_path = public;

-- ============================================================
-- 1. IMMUTABILITY (POSTED Documents)
-- ============================================================

-- Header Immutability
create or replace function public.check_immutable_posted()
returns trigger language plpgsql as $$
begin
  -- Block DELETE if POSTED
  if TG_OP = 'DELETE' then
    if OLD.status = 'POSTED' then
      raise exception 'Cannot DELETE a POSTED document (Id: %)', OLD.id;
    end if;
    return OLD;
  end if;

  -- Block UPDATE if POSTED (unless Voiding)
  if TG_OP = 'UPDATE' then
    if OLD.status = 'POSTED' then
       -- Allow transition to VOID (future proofing), otherwise Block
       if NEW.status = 'VOID' then
         return NEW;
       end if;
       
       -- If nothing changed, allow (rare but harmless)
       if NEW is not distinct from OLD then
         return NEW;
       end if;

       raise exception 'Cannot UPDATE a POSTED document (Id: %)', OLD.id;
    end if;
    return NEW;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_immutable_sales on public.sales;
create trigger trg_immutable_sales before update or delete on public.sales for each row execute function public.check_immutable_posted();

drop trigger if exists trg_immutable_purchases on public.purchases;
create trigger trg_immutable_purchases before update or delete on public.purchases for each row execute function public.check_immutable_posted();

drop trigger if exists trg_immutable_sales_returns on public.sales_returns;
create trigger trg_immutable_sales_returns before update or delete on public.sales_returns for each row execute function public.check_immutable_posted();

drop trigger if exists trg_immutable_purchase_returns on public.purchase_returns;
create trigger trg_immutable_purchase_returns before update or delete on public.purchase_returns for each row execute function public.check_immutable_posted();


-- Line Item Immutability (Block if Parent is POSTED)
create or replace function public.enforce_posted_line_immutable()
returns trigger language plpgsql as $$
declare v_status doc_status;
begin
  if TG_TABLE_NAME = 'sales_items' then
    select status into v_status from public.sales where id = OLD.sales_id;
  elsif TG_TABLE_NAME = 'purchase_items' then
    select status into v_status from public.purchases where id = OLD.purchase_id;
  elsif TG_TABLE_NAME = 'sales_return_items' then
    select status into v_status from public.sales_returns where id = OLD.sales_return_id;
  elsif TG_TABLE_NAME = 'purchase_return_items' then
    select status into v_status from public.purchase_returns where id = OLD.purchase_return_id;
  end if;

  if v_status = 'POSTED' then
    raise exception 'Cannot Update/Delete line items of a POSTED document';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_sales_items_posted_immutable on public.sales_items;
create trigger trg_sales_items_posted_immutable before update or delete on public.sales_items for each row execute function public.enforce_posted_line_immutable();

drop trigger if exists trg_purchase_items_posted_immutable on public.purchase_items;
create trigger trg_purchase_items_posted_immutable before update or delete on public.purchase_items for each row execute function public.enforce_posted_line_immutable();

drop trigger if exists trg_sales_return_items_posted_immutable on public.sales_return_items;
create trigger trg_sales_return_items_posted_immutable before update or delete on public.sales_return_items for each row execute function public.enforce_posted_line_immutable();

drop trigger if exists trg_purchase_return_items_posted_immutable on public.purchase_return_items;
create trigger trg_purchase_return_items_posted_immutable before update or delete on public.purchase_return_items for each row execute function public.enforce_posted_line_immutable();


-- ============================================================
-- 2. OPENING BALANCE LOCK
-- ============================================================
create or replace function public.lock_opening_balances_in_closed_period()
returns trigger language plpgsql as $$
declare d date;
begin
  d := case when TG_OP in ('INSERT','UPDATE') then NEW.as_of_date else OLD.as_of_date end;
  if public.is_date_in_closed_period(d) then
    raise exception 'Periode CLOSED: Ob locked';
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists trg_lock_opening_balances_period on public.opening_balances;
create trigger trg_lock_opening_balances_period before insert or update or delete on public.opening_balances for each row execute function public.lock_opening_balances_in_closed_period();


-- ============================================================
-- 3. SYSTEM ACCOUNT LOCK
-- ============================================================
create or replace function public.prevent_system_account_code_change()
returns trigger language plpgsql as $$
begin
  if old.is_system_account and old.code is distinct from new.code then
    raise exception 'System account codes cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists trg_accounts_system_code_lock on public.accounts;
create trigger trg_accounts_system_code_lock before update on public.accounts for each row execute function public.prevent_system_account_code_change();

-- Flag System Accounts
update public.accounts set is_system_account = true where code in ('1100','1110','1200','1300','1310','2100','4100','4110','5100','6100');


-- ============================================================
-- 4. UTILITIES (Reset)
-- ============================================================
create or replace function public.rpc_test_reset_data()
returns void language plpgsql security definer as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  
  -- Clear Trans
  delete from public.journal_lines;
  delete from public.journals;
  delete from public.receipts;
  delete from public.payments;
  
  delete from public.sales_return_items;
  delete from public.sales_returns;
  delete from public.purchase_return_items;
  delete from public.purchase_returns;
  
  delete from public.sales_items;
  delete from public.ar_invoices;
  delete from public.sales;
  
  delete from public.purchase_items;
  delete from public.ap_bills;
  delete from public.purchases;
  
  -- Clear Inv
  delete from public.inventory_adjustments;
  update public.inventory_stock set qty_on_hand = 0, avg_cost = 0;
  
  -- Clear Period Logs
  delete from public.period_exports;
  
  -- Reset Sequences
  update public.tx_doc_sequences set last_sequence = 0;

  -- Clear OB (Optional? usually reset clears everything generated, OB is setup)
  -- 016 cleared EVERYTHING. keeping it consistent.
  delete from public.opening_balances;

end $$;
