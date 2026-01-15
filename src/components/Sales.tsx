import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "./ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/Table";

import { Alert } from "./ui/Alert";
import { DocumentStatusBadge } from "./ui/StatusBadge";
import { Textarea } from "./ui/Textarea";
import { Icons } from "./ui/Icons";

type Customer = { id: string; name: string; price_tier: "UMUM" | "KHUSUS" };
type Item = {
  id: string;
  name: string;
  sku: string;
  uom: string;
  price_umum: number;
  price_khusus: number;
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

type SalesDraft = {
  id: string;
  sales_date?: string;
  terms?: string;
  customer?: { name?: string };
};

export default function Sales() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Header State
  const [customerId, setCustomerId] = useState("");
  const [salesDate, setSalesDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [terms, setTerms] = useState<"CASH" | "CREDIT">("CASH");
  const [notes, setNotes] = useState("");

  // Lines State
  const [lines, setLines] = useState<SalesLine[]>([]);

  // Line Input State
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState(1);

  // Drafts
  const [drafts, setDrafts] = useState<SalesDraft[]>([]);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  const fetchMasterData = useCallback(async () => {
    try {
      const { data: custData, error: custError } = await supabase
        .from("customers")
        .select("id, name, price_tier")
        .eq("is_active", true);
      if (custError) throw custError;

      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, name, sku, uom, price_umum, price_khusus")
        .eq("is_active", true);
      if (itemError) throw itemError;

      setCustomers(custData || []);
      setItems(itemData || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    const { data } = await supabase
      .from("sales")
      .select("*, customer:customers(name)")
      .eq("status", "DRAFT")
      .order("created_at", { ascending: false });
    setDrafts(data || []);
  }, []);

  useEffect(() => {
    fetchMasterData();
    fetchDrafts();
  }, [fetchMasterData, fetchDrafts]); // Initial load

  useEffect(() => {
    if (success) fetchDrafts();
  }, [success, fetchDrafts]);

  function addItem() {
    if (!selectedItemId) return;
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;

    const customer = customers.find((c) => c.id === customerId);
    let price = 0;
    if (customer) {
      price =
        customer.price_tier === "KHUSUS" ? item.price_khusus : item.price_umum;
    } else {
      price = item.price_umum;
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
      setError("Select Customer");
      return;
    }
    if (lines.length === 0) {
      setError("Add items");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .insert([
          {
            customer_id: customerId,
            sales_date: salesDate,
            terms: terms,
            status: "DRAFT",
            // notes: notes // If DB supported it
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
      setNotes("");

      const successMsg = `Draft Created! ID: ${salesId}`;
      setSuccess(successMsg);
      navigate(`/sales/${salesId}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePost(salesId: string) {
    if (!confirm("Confirm POST? This is irreversible.")) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("rpc_post_sales", {
        p_sales_id: salesId,
      });
      if (error) throw error;
      setSuccess(`Sales POSTED Successfully! Journal Created.`);
      navigate(`/sales/${salesId}`);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      if (message.includes("ck_stock_nonneg")) {
        setError(
          "FAILED: Insufficient Stock. Please add stock via Purchase or Adjustment first.",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="w-full space-y-6 pb-28">
        <div className="flex items-baseline justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Sales Management
          </h2>
          <span className="text-sm text-gray-500">
            Draft = editable, Posted = locked
          </span>
        </div>

        {error && <Alert variant="error" title="Oops" description={error} />}
        {success && (
          <Alert variant="success" title="Berhasil" description={success} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Entry Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-md border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                <CardTitle className="text-lg text-blue-800">
                  New Sales Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Header Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                  <Select
                    label="Customer"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    options={[
                      { label: "-- Select Customer --", value: "" },
                      ...customers.map((c) => ({
                        label: `${c.name} (${c.price_tier})`,
                        value: c.id,
                      })),
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
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
                  </div>
                </div>

                <Textarea
                  label="Notes (Internal)"
                  placeholder="Optional delivery notes or instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div className="my-6 border-b border-gray-100" />

                {/* Item Entry */}
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
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
                    <div className="pb-1">
                      <Button
                        type="button"
                        onClick={addItem}
                        className="w-full sm:w-auto min-h-[44px]"
                        disabled={!selectedItemId}
                      >
                        Add Item
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lines Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <Table>
                    <TableHead className="bg-gray-50">
                      <TableRow>
                        <TableHeader>Item</TableHeader>
                        <TableHeader>Qty</TableHeader>
                        <TableHeader>Price</TableHeader>
                        <TableHeader>Subtotal</TableHeader>
                        <TableHeader className="w-10">&nbsp;</TableHeader>
                      </TableRow>
                    </TableHead>
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
                  <div className="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-200">
                    <span className="font-bold text-gray-600 uppercase text-xs tracking-wider">
                      Total Amount
                    </span>
                    <span className="font-bold text-2xl text-blue-600">
                      {totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50 border-t border-gray-100 p-4">
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
          </div>

          {/* Right Column: Draft List */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-md border-gray-200 flex flex-col">
              <CardHeader className="bg-yellow-50/50 border-b border-yellow-100 pb-4">
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                  <Icons.FileText className="w-5 h-5" /> Pending Drafts
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 max-h-[600px]">
                {drafts.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10 italic">
                    No pending drafts found.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {drafts.map((d) => (
                      <li
                        key={d.id}
                        className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all bg-white group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-bold text-gray-900">
                              {d.customer?.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex gap-2 items-center">
                              <span className="flex items-center gap-1">
                                <Icons.Calendar className="w-3 h-3" />{" "}
                                {d.sales_date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Icons.DollarSign className="w-3 h-3" />{" "}
                                {d.terms}
                              </span>
                            </div>
                          </div>
                          <DocumentStatusBadge status="DRAFT" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                          <Button
                            type="submit"
                            onClick={() => handlePost(d.id)}
                            disabled={loading}
                            className="w-full sm:w-auto min-h-[44px] bg-blue-600 hover:bg-blue-700"
                            icon={<Icons.Check className="w-4 h-4" />}
                          >
                            Post Order
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
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
    </div>
  );
}
