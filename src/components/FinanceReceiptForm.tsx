import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Switch } from "./ui/Switch";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";

type Props = {
    invoiceId: string;
    initialAmount: number;
    paymentMethods: { code: string; name: string }[];
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
};

export function FinanceReceiptForm({
    invoiceId,
    initialAmount,
    paymentMethods,
    onSuccess,
    onError,
}: Props) {
    const [trxDate, setTrxDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [amount, setAmount] = useState(initialAmount);
    const [method, setMethod] = useState("CASH");
    const [isPettyCash, setIsPettyCash] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    function getErrorMessage(err: unknown) {
        if (err instanceof Error) return err.message;
        if (typeof err === "string") return err;
        if (err && typeof err === "object") {
            const anyErr = err as { message?: string; details?: string; hint?: string };
            const parts = [anyErr.message, anyErr.details, anyErr.hint].filter(Boolean);
            if (parts.length) return parts.join(" - ");
            try {
                return JSON.stringify(anyErr);
            } catch {
                return "Unexpected error";
            }
        }
        return "Unexpected error";
    }

    useEffect(() => {
        setAmount(initialAmount);
    }, [initialAmount]);

    useEffect(() => {
        // Default method
        if (paymentMethods.length && !paymentMethods.some(m => m.code === method)) {
            setMethod(paymentMethods[0].code);
        }
    }, [paymentMethods, method]);

    useEffect(() => {
        if (isPettyCash && method !== "CASH") {
            setMethod("CASH");
        }
    }, [isPettyCash, method]);

    function handleAmountChange(value: string) {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            setAmount(0);
            return;
        }

        const maxOutstanding = Math.max(initialAmount, 0);
        const maxAllowed = isPettyCash ? Math.min(maxOutstanding, 500000) : maxOutstanding;
        setAmount(Math.min(parsed, maxAllowed));
    }

    async function handleSubmit() {
        if (!invoiceId) return;
        if (amount <= 0) {
            onError("Amount must be > 0");
            return;
        }
        if (amount > initialAmount) {
            onError("Amount cannot exceed outstanding amount");
            return;
        }

        const normalizedMethod = (method || "CASH").toUpperCase();

        if (isPettyCash && normalizedMethod !== "CASH") {
            onError("Petty cash receipts must use CASH method");
            return;
        }

        if (isPettyCash && amount > 500000) {
            onError("Petty cash receipts limited to 500.000");
            return;
        }

        setSubmitting(true);

        try {
            const { error } = await supabase.rpc("rpc_create_receipt_ar", {
                p_ar_invoice_id: invoiceId,
                p_amount: amount,
                p_receipt_date: trxDate,
                p_method: normalizedMethod,
                p_is_petty_cash: isPettyCash,
            });
            if (error) throw error;
            onSuccess("Receipt Created Successfully!");
            // Reset logic handled by parent unmounting/clearing selection or we reset here?
            // Usually parent clears selection.
        } catch (err: unknown) {
            onError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    const methodOptions =
        paymentMethods.length > 0
            ? paymentMethods.map((m) => ({
                label: `${m.code} - ${m.name}`,
                value: m.code,
            }))
            : [
                { label: "CASH", value: "CASH" },
                { label: "BANK", value: "BANK" },
            ];

    return (
        <Card className="border-green-200 shadow-md sticky top-6">
            <CardHeader className="bg-green-100/50 border-b border-green-100">
                <CardTitle className="text-green-900">Process Receipt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
                <div className="text-xs text-gray-500 font-mono mb-2">
                    REF: {invoiceId}
                </div>
                <Input
                    label="Date"
                    type="date"
                    value={trxDate}
                    onChange={(e) => setTrxDate(e.target.value)}
                />
                <Input
                    label="Amount Received"
                    type="number"
                    step="1"
                    value={amount === 0 ? "" : amount}
                    max={isPettyCash ? Math.min(initialAmount, 500000) : initialAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                />
                <div className="text-[11px] text-gray-500 flex items-center justify-between">
                    <span>Outstanding: {initialAmount.toLocaleString()}</span>
                    <span>Remaining: {Math.max(initialAmount - amount, 0).toLocaleString()}</span>
                </div>
                <Select
                    label="Method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    options={methodOptions}
                    disabled={isPettyCash}
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                    <Switch
                        label="Petty Cash"
                        checked={isPettyCash}
                        onCheckedChange={(checked) => setIsPettyCash(checked)}
                    />
                    <p className="text-xs text-gray-500">
                        {isPettyCash
                            ? "Petty cash hanya untuk Kas dan maksimal Rp 500.000."
                            : "Gunakan toggle ini bila ingin mencatat petty cash receipt."}
                    </p>
                </div>
                <Button
                    className="w-full mt-4 bg-green-600 hover:bg-green-700"
                    onClick={handleSubmit}
                    disabled={submitting}
                    isLoading={submitting}
                >
                    Confirm Receipt
                </Button>
            </CardContent>
        </Card>
    );
}
