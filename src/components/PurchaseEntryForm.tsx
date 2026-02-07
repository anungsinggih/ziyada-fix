import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { ButtonSelect } from "./ui/ButtonSelect";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "./ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";
import { Textarea } from "./ui/Textarea";
import { Icons } from "./ui/Icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TotalFooter } from "./ui/TotalFooter";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/Dialog";
// import VendorForm from "./VendorForm"; 
import { Combobox } from "./ui/Combobox";

type Vendor = {
    id: string;
    name: string;
    phone: string;
    address: string;
    is_active: boolean;
};

type Item = {
    id: string;
    name: string;
    sku: string;
    uom: string;
    default_price_buy: number;
    type: string; // Added type for filtering
};
type PurchaseLine = {
    item_id: string;
    item_name: string;
    sku: string;
    uom: string;
    qty: number;
    cost_price: number;
    subtotal: number;
};

type Props = {
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
    onSaved?: (purchaseId: string) => void;
    redirectOnSave?: boolean;
    initialPurchaseId?: string;
};

export function PurchaseEntryForm({ onSuccess, onError, onSaved, redirectOnSave = true, initialPurchaseId }: Props) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [vendorId, setVendorId] = useState("");
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
    const [terms, setTerms] = useState<"CASH" | "CREDIT">("CASH");
    const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);
    const [paymentMethodCode, setPaymentMethodCode] = useState("CASH");
    const [notes, setNotes] = useState("");
    const [discountAmount, setDiscountAmount] = useState(0);
    const [lines, setLines] = useState<PurchaseLine[]>([]);

    // Line Input State
    const [selectedItemId, setSelectedItemId] = useState("");
    const [costPrice, setCostPrice] = useState<number | null>(null);
    const [qty, setQty] = useState(1);
    const [itemFilter, setItemFilter] = useState<"ALL" | "RAW_MATERIAL" | "TRADED">("ALL");

    // Refs for Accessibility
    // const itemSelectRef = useRef<HTMLButtonElement>(null); // Replaced by Combobox
    const costInputRef = useRef<HTMLInputElement>(null);

    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) return error.message;
        if (typeof error === "object" && error !== null) {
            const err = error as { message?: string };
            return err.message || JSON.stringify(error);
        }
        return String(error);
    };

    const normalizeLines = useCallback((source: PurchaseLine[]) => {
        const map = new Map<string, PurchaseLine>();
        source.forEach((line) => {
            const key = `${line.item_id}::${line.cost_price}::${line.uom}`;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, { ...line });
                return;
            }
            const mergedQty = existing.qty + line.qty;
            map.set(key, {
                ...existing,
                qty: mergedQty,
                subtotal: existing.subtotal + line.subtotal
            });
        });
        return Array.from(map.values());
    }, []);

    const presetVendorId = searchParams.get("vendor") || "";

    const fetchMasterData = useCallback(async () => {
        try {
            const { data: venData, error: venError } = await supabase
                .from("vendors")
                .select("id, name, phone, address, is_active")
                .eq("is_active", true);
            if (venError) throw venError;
            const { data: itemData, error: itemError } = await supabase
                .from("items")
                .select("id, name, sku, uom, default_price_buy, type") // Added type column
                .eq("is_active", true);
            if (itemError) throw itemError;

            const { data: methodData, error: methodError } = await supabase
                .from("payment_methods")
                .select("code, name")
                .eq("is_active", true)
                .order("code", { ascending: true });
            if (methodError) throw methodError;

            setVendors((venData as unknown as Vendor[]) || []);
            setItems(itemData || []);
            setPaymentMethods(methodData || []);
        } catch (err: unknown) {
            onError(getErrorMessage(err)); // Fixed argument count
        }
    }, [onError]);

    useEffect(() => {
        fetchMasterData();
    }, [fetchMasterData]);

    useEffect(() => {
        if (!initialPurchaseId && presetVendorId && !vendorId) {
            setVendorId(presetVendorId);
        }
    }, [presetVendorId, vendorId, initialPurchaseId]);

    useEffect(() => {
        if (!initialPurchaseId) return;

        const loadPurchase = async () => {
            setLoading(true);
            try {
                const { data: purchaseData, error: purchaseError } = await supabase
                    .from("purchases")
                    .select("*")
                    .eq("id", initialPurchaseId)
                    .single();

                if (purchaseError) throw purchaseError;

                if (purchaseData.status !== "DRAFT") {
                    throw new Error(`Cannot edit ${purchaseData.status} purchase.`);
                }

                setVendorId(purchaseData.vendor_id);
                setPurchaseDate(purchaseData.purchase_date);
                setTerms(purchaseData.terms);
                setPaymentMethodCode(purchaseData.payment_method_code || "CASH");
                setNotes(purchaseData.notes || "");
                setDiscountAmount(Number(purchaseData.discount_amount) || 0);

                const { data: itemsData, error: itemsError } = await supabase
                    .from("purchase_items")
                    .select(
                        `
                        item_id,
                        qty,
                        unit_cost,
                        subtotal,
                        uom_snapshot,
                        items (
                            name,
                            sku
                        )
                    `
                    )
                    .eq("purchase_id", initialPurchaseId);

                if (itemsError) throw itemsError;

                const loadedLines: PurchaseLine[] =
                    itemsData?.map((item) => {
                        const iData = Array.isArray(item.items) ? item.items[0] : item.items;
                        return {
                            item_id: item.item_id,
                            item_name: iData?.name || "Unknown",
                            sku: iData?.sku || "",
                            uom: item.uom_snapshot,
                            qty: item.qty,
                            cost_price: item.unit_cost,
                            subtotal: item.subtotal,
                        };
                    }) || [];

                const uniqueLines = normalizeLines(loadedLines);
                setLines(uniqueLines);
            } catch (err: unknown) {
                onError(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        };

        loadPurchase();
    }, [initialPurchaseId, onError, normalizeLines]);

    useEffect(() => {
        if (terms === "CREDIT") {
            setPaymentMethodCode("");
            return;
        }
        if (!paymentMethodCode) {
            const hasCash = paymentMethods.some((m) => m.code === "CASH");
            setPaymentMethodCode(hasCash ? "CASH" : paymentMethods[0]?.code || "");
        }
    }, [terms, paymentMethods, paymentMethodCode]);

    const parseQtyValue = (value: string) => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) return 1;
        return Math.max(1, parsed);
    };

    const parseCostValue = (value: string) => {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) return 0;
        return Math.max(0, parsed);
    };

    function addItem() {
        if (!selectedItemId) return;
        const item = items.find((i) => i.id === selectedItemId);
        if (!item) return;
        if (costPrice === null || costPrice < 0) { // Check for null
            alert("Cost must be >= 0");
            return;
        }

        const safeQty = Math.max(1, qty);
        const safeCost = Math.max(0, costPrice);

        const newLine: PurchaseLine = {
            item_id: item.id,
            item_name: item.name,
            sku: item.sku,
            uom: item.uom,
            qty: safeQty,
            cost_price: safeCost,
            subtotal: safeQty * safeCost,
        };
        setLines((prev) => {
            const existingIndex = prev.findIndex(
                (l) => l.item_id === newLine.item_id && l.cost_price === newLine.cost_price
            );
            if (existingIndex === -1) return [...prev, newLine];
            const next = [...prev];
            const existing = next[existingIndex];
            const mergedQty = existing.qty + newLine.qty;
            next[existingIndex] = {
                ...existing,
                qty: mergedQty,
                subtotal: mergedQty * existing.cost_price,
            };
            return next;
        });
        setSelectedItemId("");
        setQty(1);
        setCostPrice(null); // Reset to null

        // Auto-focus back to item select
        setTimeout(() => {
            const btn = document.querySelector('button[role="combobox"]');
            if (btn instanceof HTMLElement) btn.focus();
        }, 0);
    }

    function removeLine(index: number) {
        setLines(lines.filter((_, i) => i !== index));
    }

    const itemsTotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
    const totalAmount = itemsTotal - (discountAmount || 0);

    const handleSaveDraft = useCallback(async () => {
        if (!vendorId) {
            onError("Select Vendor");
            return;
        }
        if (terms === "CASH" && !paymentMethodCode) {
            onError("Select Payment Method");
            return;
        }
        if (lines.length === 0) {
            onError("Add items");
            return;
        }
        if (totalAmount < 0) {
            onError("Diskon terlalu besar");
            return;
        }

        setLoading(true);
        try {
            if (initialPurchaseId) {
                const { error: headerError } = await supabase
                    .from("purchases")
                    .update({
                        vendor_id: vendorId,
                        purchase_date: purchaseDate,
                        terms,
                        notes: notes || null,
                        total_amount: totalAmount,
                        discount_amount: discountAmount || 0,
                        payment_method_code: terms === "CASH" ? paymentMethodCode : null,
                    })
                    .eq("id", initialPurchaseId)
                    .eq("status", "DRAFT");

                if (headerError) throw headerError;

                const normalizedLines = normalizeLines(lines);
                if (normalizedLines.length !== lines.length) {
                    setLines(normalizedLines);
                }

                // Use RPC for Atomic Update (Prevents Duplicate Items Bug)
                const lineData = normalizedLines.map((l) => ({
                    purchase_id: initialPurchaseId,
                    item_id: l.item_id,
                    qty: l.qty,
                    unit_cost: l.cost_price,
                    subtotal: l.subtotal,
                    uom_snapshot: l.uom,
                }));

                const { error: rpcError } = await supabase.rpc('rpc_update_purchase_draft_items', {
                    p_purchase_id: initialPurchaseId,
                    p_items: lineData
                });

                if (rpcError) throw rpcError;

                onSuccess(`Draft Updated! ID: ${initialPurchaseId}`);
                onSaved?.(initialPurchaseId);
                if (redirectOnSave) {
                    navigate(`/purchases/${initialPurchaseId}`);
                }
            } else {
                const { data: purData, error: purError } = await supabase
                    .from("purchases")
                    .insert([
                        {
                            vendor_id: vendorId,
                            purchase_date: purchaseDate,
                            terms,
                            status: "DRAFT",
                            notes: notes || null,
                            total_amount: totalAmount,
                            discount_amount: discountAmount || 0,
                            payment_method_code: terms === "CASH" ? paymentMethodCode : null,
                        },
                    ])
                    .select()
                    .single();

                if (purError) throw purError;
                const purId = purData.id;

                const normalizedLines = normalizeLines(lines);
                if (normalizedLines.length !== lines.length) {
                    setLines(normalizedLines);
                }

                const lineData = normalizedLines.map((l) => ({
                    purchase_id: purId,
                    item_id: l.item_id,
                    qty: l.qty,
                    unit_cost: l.cost_price,
                    subtotal: l.subtotal,
                    uom_snapshot: l.uom,
                }));
                const { error: linesError } = await supabase
                    .from("purchase_items")
                    .insert(lineData);
                if (linesError) throw linesError;

                setLines([]);
                setVendorId("");
                setTerms("CASH");
                setPaymentMethodCode("CASH");
                setNotes("");
                setDiscountAmount(0);
                onSuccess(`Draft Created! ID: ${purId}`);
                onSaved?.(purId);
                if (redirectOnSave) {
                    navigate(`/purchases/${purId}`);
                }
            }
        } catch (err: unknown) {
            onError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [
        vendorId,
        onError,
        terms,
        paymentMethodCode,
        lines,
        totalAmount,
        discountAmount,
        normalizeLines,
        initialPurchaseId,
        purchaseDate,
        notes,
        onSuccess,
        onSaved,
        redirectOnSave,
        navigate
    ]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F2") {
                e.preventDefault();
                handleSaveDraft();
            }
            if (e.key === "F4") {
                e.preventDefault();
                const btn = document.querySelector('button[role="combobox"]');
                if (btn instanceof HTMLElement) {
                    btn.focus();
                    btn.click();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleSaveDraft]);

    return (
        <>
            <Card className="shadow-md border-gray-200 h-full">
                <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg text-purple-800">
                        {initialPurchaseId ? "Edit Purchase (DRAFT)" : "New Purchase Order"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6" onKeyDown={(e) => {
                    if (e.key === "F2") {
                        e.preventDefault();
                        handleSaveDraft();
                    }
                    if (e.key === "F4") {
                        e.preventDefault();
                        const btn = document.querySelector('button[role="combobox"]');
                        if (btn instanceof HTMLElement) {
                            btn.focus();
                            btn.click();
                        }
                    }
                }}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-4">
                            <Combobox
                                label="Vendor"
                                value={vendorId}
                                onChange={(val) => setVendorId(val)}
                                placeholder="-- Select Vendor --"
                                searchPlaceholder="Search vendor..."
                                options={vendors.map((v) => ({ label: v.name, value: v.id }))}
                            />
                            <Input
                                label="Date"
                                type="date"
                                value={purchaseDate}
                                onChange={(e) => setPurchaseDate(e.target.value)}
                            />
                            <ButtonSelect
                                label="Terms"
                                value={terms}
                                onChange={(val: string) => setTerms(val as "CASH" | "CREDIT")}
                                options={[
                                    { label: "CASH", value: "CASH" },
                                    { label: "CREDIT", value: "CREDIT" },
                                ]}
                            />
                            {terms === "CASH" && (
                                <ButtonSelect
                                    label="Payment Method"
                                    value={paymentMethodCode}
                                    onChange={(val: string) => setPaymentMethodCode(val)}
                                    options={paymentMethods.map((m) => ({
                                        label: `${m.name} (${m.code})`,
                                        value: m.code,
                                    }))}
                                />
                            )}
                            <Input
                                label="Diskon"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={discountAmount === 0 ? "" : discountAmount}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                            />
                            <Textarea
                                label="Notes (Internal)"
                                placeholder="Vendor reference number or internal notes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                                <h4 className="font-semibold mb-3 text-sm text-purple-900 uppercase tracking-wide">
                                    Add Items
                                </h4>
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                                    <div className="flex-grow">
                                        <div className="flex flex-col gap-1.5 mb-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-medium text-[var(--text-main)]">Product (F4)</label>
                                                <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                                    {(["ALL", "RAW_MATERIAL", "TRADED"] as const).map(type => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => {
                                                                setItemFilter(type);
                                                                setSelectedItemId(""); // Reset to avoid stale ID
                                                                setCostPrice(null);    // Also reset cost
                                                            }}
                                                            className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-md transition-all ${itemFilter === type
                                                                ? "bg-white text-purple-700 shadow-sm"
                                                                : "text-gray-400 hover:text-gray-600"
                                                                }`}
                                                        >
                                                            {type === "RAW_MATERIAL" ? "RAW" : type}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <Combobox
                                                value={selectedItemId}
                                                onChange={(val) => {
                                                    const newItemId = val;
                                                    setSelectedItemId(newItemId);

                                                    // Auto-fill cost price if enabled
                                                    if (newItemId) {
                                                        const item = items.find((i) => i.id === newItemId);
                                                        if (item) {
                                                            setCostPrice(item.default_price_buy || 0);
                                                        }

                                                        // Auto focus to Cost Price
                                                        setTimeout(() => costInputRef.current?.focus(), 0);
                                                    }
                                                }}
                                                placeholder="Select Item..."
                                                searchPlaceholder="Search User, SKU or Name..."
                                                options={items
                                                    .filter(i => itemFilter === "ALL" ? true : i.type === itemFilter)
                                                    .map((i) => ({
                                                        label: `${i.sku} - ${i.name}`,
                                                        value: i.id,
                                                        keywords: [i.sku, i.name],
                                                        content: (
                                                            <div className="flex justify-between w-full">
                                                                <span><span className="font-mono text-gray-500 mr-2">{i.sku}</span>{i.name}</span>
                                                            </div>
                                                        )
                                                    }))}
                                                className="!mb-0"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-24">
                                        <Input
                                            label="Qty"
                                            type="number"
                                            inputMode="numeric"
                                            value={qty}
                                            min={1}
                                            step={1}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setQty(parseQtyValue(e.target.value))}
                                            containerClassName="!mb-0"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <Input
                                            label="Cost Price"
                                            type="number"
                                            inputMode="decimal"
                                            step="1"
                                            value={costPrice === null || costPrice === 0 ? "" : costPrice}
                                            placeholder="0"
                                            min={0}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) =>
                                                setCostPrice(parseCostValue(e.target.value))
                                            }
                                            containerClassName="!mb-0"
                                        />
                                    </div>
                                    <div className="">
                                        <Button
                                            type="button"
                                            onClick={addItem}
                                            className="w-full sm:w-auto min-h-[44px]"
                                            disabled={!selectedItemId}
                                        >
                                            Add Item
                                        </Button>
                                    </div>
                                </div >
                            </div >

                            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-gray-50">
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Cost</TableHead>
                                            <TableHead>Subtotal</TableHead>
                                            <TableHead className="w-10">&nbsp;</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={5}
                                                    className="text-center text-gray-400 py-8 italic bg-gray-50/30"
                                                >
                                                    No items added to cart
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            lines.map((l, i) => (
                                                <TableRow key={i} className="hover:bg-gray-50/50">
                                                    <TableCell className="font-medium text-gray-900">
                                                        {l.item_name}
                                                        <div className="text-xs text-gray-500">{l.sku}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {l.qty}{" "}
                                                        <span className="text-xs text-gray-500">
                                                            {l.uom}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{l.cost_price.toLocaleString()}</TableCell>
                                                    <TableCell className="font-semibold">
                                                        {l.subtotal.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <button
                                                            className="text-gray-400 hover:text-red-600 transition-colors"
                                                            onClick={() => removeLine(i)}
                                                        >
                                                            <Icons.Trash className="w-4 h-4" />
                                                        </button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                <TotalFooter label="Items Total" amount={itemsTotal} />
                                <TotalFooter label="Diskon" amount={discountAmount || 0} />
                                <TotalFooter label="Total Amount" amount={totalAmount} amountClassName="text-purple-600" />
                            </div>
                        </div >
                    </div >
                </CardContent >
                <CardFooter className="bg-gray-50 border-t border-gray-100 p-4 hidden md:flex">
                    <Button
                        onClick={handleSaveDraft}
                        disabled={loading}
                        className="w-full h-12 text-lg shadow-sm"
                        icon={<Icons.Save className="w-5 h-5" />}
                    >
                        {loading ? "Saving..." : "Save Draft"}
                    </Button>
                </CardFooter>
            </Card >

            <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
                <Button
                    onClick={handleSaveDraft}
                    disabled={loading}
                    isLoading={loading}
                    className="w-full"
                >
                    Save Draft
                </Button>
            </div>
        </>
    );
}
