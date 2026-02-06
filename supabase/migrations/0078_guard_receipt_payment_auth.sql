-- ============================================================
-- 0078_guard_receipt_payment_auth.sql
-- Require admin/owner for AR receipt & AP payment RPCs
-- ============================================================

create or replace function public.rpc_create_receipt_ar(p_ar_invoice_id uuid, p_amount numeric, p_receipt_date date, p_method text, p_is_petty_cash boolean default false)
returns jsonb language plpgsql security definer as $$
declare
  v_ar record; v_receipt_id uuid; v_journal_id uuid; v_cash_acc_id uuid; v_ar_acc_id uuid; v_new_outstanding numeric; v_method text;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  v_method := upper(coalesce(p_method, 'CASH'));
  select public.get_payment_account_for_method(v_method) into v_cash_acc_id;
  select id into v_ar_acc_id from public.accounts where code = '1200';
  if p_amount <= 0 then raise exception 'Amount > 0'; end if;
  if p_is_petty_cash and v_method <> 'CASH' then raise exception 'Petty cash must use CASH method'; end if;
  if p_is_petty_cash and p_amount > 500000 then raise exception 'Petty cash max 500000'; end if;
  
  select * into v_ar from public.ar_invoices where id = p_ar_invoice_id for update;
  if not found then raise exception 'AR not found'; end if;
  if v_ar.outstanding_amount <= 0 then raise exception 'Already paid'; end if;
  if p_amount > v_ar.outstanding_amount then raise exception 'Overpayment'; end if;
  
  v_new_outstanding := v_ar.outstanding_amount - p_amount;
  if public.is_date_in_closed_period(coalesce(p_receipt_date, v_ar.invoice_date)) then raise exception 'Periode CLOSED'; end if;

  insert into public.receipts(receipt_date, source, ref_type, ref_id, amount, method, is_petty_cash)
  values (coalesce(p_receipt_date, v_ar.invoice_date), 'AR_PAYMENT', 'ar_invoice', p_ar_invoice_id, p_amount, v_method, coalesce(p_is_petty_cash, false))
  returning id into v_receipt_id;

  update public.ar_invoices set outstanding_amount = v_new_outstanding, status = case when v_new_outstanding=0 then 'PAID' else 'PARTIAL' end where id = p_ar_invoice_id;

  v_journal_id := public.create_journal(coalesce(p_receipt_date, v_ar.invoice_date), 'receipt', v_receipt_id, 'AR Receipt');
  perform public.add_journal_line(v_journal_id, v_cash_acc_id, p_amount, 0, 'Cash received');
  perform public.add_journal_line(v_journal_id, v_ar_acc_id, 0, p_amount, 'Reduce AR');

  return jsonb_build_object('ok', true, 'receipt_id', v_receipt_id);
end $$;

create or replace function public.rpc_create_payment_ap(p_ap_bill_id uuid, p_amount numeric, p_payment_date date, p_method text)
returns jsonb language plpgsql security definer as $$
declare
  v_ap record; v_pay_id uuid; v_journal_id uuid; v_cash_acc_id uuid; v_ap_acc_id uuid; v_new_outstanding numeric; v_method text;
begin
  if not (public.is_admin() or public.is_owner()) then raise exception 'Auth failed'; end if;
  v_method := upper(coalesce(p_method, 'CASH'));
  select public.get_payment_account_for_method(v_method) into v_cash_acc_id;
  select id into v_ap_acc_id from public.accounts where code = '2100';
  if p_amount <= 0 then raise exception 'Amount > 0'; end if;

  select * into v_ap from public.ap_bills where id = p_ap_bill_id for update;
  if not found then raise exception 'AP not found'; end if;
  if v_ap.outstanding_amount <= 0 then raise exception 'Already paid'; end if;
  if p_amount > v_ap.outstanding_amount then raise exception 'Overpayment'; end if;

  v_new_outstanding := v_ap.outstanding_amount - p_amount;
  if public.is_date_in_closed_period(coalesce(p_payment_date, v_ap.bill_date)) then raise exception 'Periode CLOSED'; end if;

  insert into public.payments(payment_date, source, ref_type, ref_id, amount, method)
  values (coalesce(p_payment_date, v_ap.bill_date), 'AP_PAYMENT', 'ap_bill', p_ap_bill_id, p_amount, v_method)
  returning id into v_pay_id;

  update public.ap_bills set outstanding_amount = v_new_outstanding, status = case when v_new_outstanding=0 then 'PAID' else 'PARTIAL' end where id = p_ap_bill_id;

  v_journal_id := public.create_journal(coalesce(p_payment_date, v_ap.bill_date), 'payment', v_pay_id, 'AP Payment');
  perform public.add_journal_line(v_journal_id, v_ap_acc_id, p_amount, 0, 'Reduce AP');
  perform public.add_journal_line(v_journal_id, v_cash_acc_id, 0, p_amount, 'Cash paid');

  return jsonb_build_object('ok', true, 'payment_id', v_pay_id);
end $$;
