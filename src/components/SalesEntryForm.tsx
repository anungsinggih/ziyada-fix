import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "./ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";
import { Textarea } from "./ui/Textarea";
import { Icons } from "./ui/Icons";
import { useNavigate } from "react-router-dom";
import { TotalFooter } from "./ui/TotalFooter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/Dialog";
import CustomerForm from "./CustomerForm";

type Customer = { id: string; name: string };
type Item = {
    id: string;
    name: string;
    sku: string;
    uom: string;
    price_default: number;
};
type SalesLine = {
    item_id: string;
    item_name: string;
    sku: string;
    uom: string;
    qty: number;
    unit_price: number;
    subtotal: number;
};

type Props = {
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
};

export function SalesEntryForm({ onSuccess, onError }: Props) {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [customerPriceMap, setCustomerPriceMap] = useState<Record<string, number>>({});

    // Form State
    const [customerId, setCustomerId] = useState("");
    const [salesDate, setSalesDate] = useState(new Date().toISOString().split("T")[0]);
    const [terms, setTerms] = useState<"CASH" | "CREDIT">("CASH");
    const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);
    const [paymentMethodCode, setPaymentMethodCode] = useState("CASH");
    const [notes, setNotes] = useState("");
    const [lines, setLines] = useState<SalesLine[]>([]);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

    // Line Input State
    const [selectedItemId, setSelectedItemId] = useState("");
    const [qty, setQty] = useState(1);

    const getErrorMessage = (error: unknown) =>
        error instanceof Error ? error.message : String(error);

    const fetchMasterData = useCallback(async () => {
        try {
            const { data: custData, error: custError } = await supabase
                .from("customers")
                .select("id, name")
                .eq("is_active", true);
            if (custError) throw custError;

            const { data: itemData, error: itemError } = await supabase
                .from("items")
                .select("id, name, sku, uom, price_default")
                .eq("is_active", true);
            if (itemError) throw itemError;

            const { data: methodData, error: methodError } = await supabase
                .from("payment_methods")
                .select("code, name")
                .eq("is_active", true)
                .order("code", { ascending: true });
            if (methodError) throw methodError;

            setCustomers(custData || []);
            setItems(itemData || []);
            setPaymentMethods(methodData || []);
        } catch (err: unknown) {
            onError(getErrorMessage(err));
        }
    }, [onError]);

    useEffect(() => {
        fetchMasterData();
    }, [fetchMasterData]);

    async function handleCustomerCreated() {
        setIsCustomerModalOpen(false);
        await fetchMasterData();
        const { data, error } = await supabase
            .from("customers")
            .select("id")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (!error && data?.id) {
            setCustomerId(data.id);
        }
    }

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

    useEffect(() => {
        if (!customerId) {
            setCustomerPriceMap({});
            return;
        }
        const loadPrices = async () => {
            const { data, error } = await supabase
                .from("customer_item_prices")
                .select("item_id, price")
                .eq("customer_id", customerId)
                .eq("is_active", true);
            if (error) {
                onError(getErrorMessage(error));
                return;
            }
            const map: Record<string, number> = {};
            (data || []).forEach((row) => {
                map[row.item_id as string] = Number(row.price);
            });
            setCustomerPriceMap(map);
        };
        loadPrices();
    }, [customerId, onError]);

    useEffect(() => {
        if (!customerId || lines.length === 0) return;
        setLines((prev) =>
            prev.map((line) => {
                const item = items.find((i) => i.id === line.item_id);
                if (!item) return line;
                const override = customerPriceMap[line.item_id];
                const unitPrice = override !== undefined ? override : item.price_default;
                if (unitPrice === line.unit_price) return line;
                return {
                    ...line,
                    unit_price: unitPrice,
                    subtotal: unitPrice * line.qty,
                };
            })
        );
    }, [customerId, customerPriceMap, items, lines.length]);

    function addItem() {
        if (!selectedItemId) return;
        const item = items.find((i) => i.id === selectedItemId);
        if (!item) return;

        let price = 0;
        if (customerId && customerPriceMap[selectedItemId] !== undefined) {
            price = customerPriceMap[selectedItemId];
        } else {
            price = item.price_default;
        }

        const newLine: SalesLine = {
            item_id: item.id,
            item_name: item.name,
            sku: item.sku,
            uom: item.uom,
            qty: qty,
            unit_price: price,
            subtotal: qty * price,
        };

        setLines([...lines, newLine]);
        setSelectedItemId("");
        setQty(1);
    }

    function removeLine(index: number) {
        setLines(lines.filter((_, i) => i !== index));
    }

    const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0);

    async function handleSaveDraft() {
        if (!customerId) {
            onError("Select Customer");
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

        setLoading(true);
        try {
            const { data: salesData, error: salesError } = await supabase
                .from("sales")
                .insert([
                    {
                        customer_id: customerId,
                        sales_date: salesDate,
                        terms: terms,
                        status: "DRAFT",
                        notes: notes || null,
                        total_amount: totalAmount,
                        payment_method_code: terms === "CASH" ? paymentMethodCode : null
                    },
                ])
                .select()
                .single();

            if (salesError) throw salesError;
            const salesId = salesData.id;

            const lineData = lines.map((l) => ({
                sales_id: salesId,
                item_id: l.item_id,
                qty: l.qty,
                unit_price: l.unit_price,
                subtotal: l.subtotal,
                uom_snapshot: l.uom,
            }));

            const { error: linesError } = await supabase
                .from("sales_items")
                .insert(lineData);
            if (linesError) throw linesError;

            setLines([]);
            setCustomerId("");
            setTerms("CASH");
            setPaymentMethodCode("CASH");
            setNotes("");

            onSuccess(`Draft Created! ID: ${salesId}`);
            navigate(`/sales/${salesId}`);
        } catch (err: unknown) {
            onError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Card className="shadow-md border-gray-200 h-full">
                <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg text-blue-800">
                        New Sales Order
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Section */}
                        <div className="lg:col-span-1 space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-[var(--text-main)]">Customer</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomerModalOpen(true)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                    >
                                        <Icons.Plus className="w-3 h-3" />
                                        New Customer
                                    </button>
                                </div>
                                <Select
                                    label=""
                                    value={customerId}
                                    onChange={(e) => setCustomerId(e.target.value)}
                                    options={[
                                        { label: "-- Select Customer --", value: "" },
                                        ...customers.map((c) => ({
                                            label: c.name,
                                            value: c.id,
                                        })),
                                    ]}
                                />
                            </div>
                            <Input
                                label="Date"
                                type="date"
                                value={salesDate}
                                onChange={(e) => setSalesDate(e.target.value)}
                            />
                            <Select
                                label="Terms"
                                value={terms}
                                onChange={(e) =>
                                    setTerms(e.target.value as "CASH" | "CREDIT")
                                }
                                options={[
                                    { label: "CASH", value: "CASH" },
                                    { label: "CREDIT", value: "CREDIT" },
                                ]}
                            />
                            {terms === "CASH" && (
                                <Select
                                    label="Payment Method"
                                    value={paymentMethodCode}
                                    onChange={(e) => setPaymentMethodCode(e.target.value)}
                                    options={[
                                        { label: "-- Select Method --", value: "" },
                                        ...paymentMethods.map((m) => ({
                                            label: `${m.name} (${m.code})`,
                                            value: m.code,
                                        })),
                                    ]}
                                />
                            )}
                            <Textarea
                                label="Notes (Internal)"
                                placeholder="Optional delivery notes or instructions..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        {/* Right Section */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Item Entry */}
                            <div className={`bg-blue-50/50 p-4 rounded-lg border border-blue-100 ${!customerId ? 'opacity-60 pointer-events-none' : ''}`}>
                                <h4 className="font-semibold mb-3 text-sm text-blue-900 uppercase tracking-wide">
                                    Add Items
                                </h4>
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                                    <div className="flex-grow">
                                        <Select
                                            label="Product"
                                            value={selectedItemId}
                                            onChange={(e) => setSelectedItemId(e.target.value)}
                                            options={[
                                                { label: "-- Select Item --", value: "" },
                                                ...items.map((i) => ({
                                                    label: `${i.sku} - ${i.name}`,
                                                    value: i.id,
                                                })),
                                            ]}
                                        />
                                    </div>
                                    <div className="w-28">
                                        <Input
                                            label="Qty"
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            value={qty}
                                            onChange={(e) => setQty(parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="w-36">
                                        <Input
                                            label="Price Sales"
                                            value={(() => {
                                                const item = items.find((i) => i.id === selectedItemId);
                                                if (!item) return "-";
                                                const override = customerPriceMap[selectedItemId];
                                                const price = override !== undefined ? override : item.price_default;
                                                return price.toLocaleString();
                                            })()}
                                            readOnly
                                        />
                                    </div>
                                    <div className="pb-1">
                                        <Button
                                            type="button"
                                            onClick={addItem}
                                            className="w-full sm:w-auto min-h-[44px]"
                                            disabled={!selectedItemId || !customerId}
                                        >
                                            Add Item
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Lines Table */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-gray-50">
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Price</TableHead>
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
                                                        <div className="text-xs text-gray-500">
                                                            {l.sku}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {l.qty}{" "}
                                                        <span className="text-xs text-gray-500">
                                                            {l.uom}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {l.unit_price.toLocaleString()}
                                                    </TableCell>
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
                                <TotalFooter label="Total Amount" amount={totalAmount} amountClassName="text-blue-600" />
                            </div>
                        </div>
                    </div>
                </CardContent>
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
            </Card>

            <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
                <Button
                    onClick={handleSaveDraft}
                    className="w-full"
                    disabled={loading}
                    isLoading={loading}
                >
                    Save Draft
                </Button>
            </div>

            <Dialog isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)}>
                <DialogHeader>
                    <DialogTitle>New Customer</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <CustomerForm
                        onSuccess={handleCustomerCreated}
                        onCancel={() => setIsCustomerModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
