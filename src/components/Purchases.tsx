import { useEffect, useState } from "react";
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

import { Textarea } from "./ui/Textarea";
import { Alert } from "./ui/Alert";
import { DocumentStatusBadge } from "./ui/StatusBadge";
import { Icons } from "./ui/Icons";

type Vendor = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  sku: string;
  uom: string;
  default_price_buy: number;
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

export default function Purchases() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Header
  const [vendorId, setVendorId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [terms, setTerms] = useState<"CASH" | "CREDIT">("CASH");
  const [notes, setNotes] = useState("");

  // Lines & Inputs
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [costPrice, setCostPrice] = useState(0);

  const [drafts, setDrafts] = useState<any[]>([]);
  const navigate = useNavigate();

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

  useEffect(() => {
    fetchMasterData();
    fetchDrafts();
  }, []);

  useEffect(() => {
    if (success) fetchDrafts();
  }, [success]);

  async function fetchMasterData() {
    try {
      const { data: venData, error: venError } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("is_active", true);
      if (venError) throw venError;
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, name, sku, uom, default_price_buy");
      if (itemError) throw itemError;

      setVendors(venData || []);
      setItems(itemData || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function fetchDrafts() {
    const { data } = await supabase
      .from("purchases")
      .select("*, vendor:vendors(name)")
      .eq("status", "DRAFT")
      .order("created_at", { ascending: false });
    setDrafts(data || []);
  }

  function addItem() {
    if (!selectedItemId) return;
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;
    if (costPrice < 0) {
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
    setLines([...lines, newLine]);
    setSelectedItemId("");
    setQty(1);
    setCostPrice(0);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0);

  async function handleSaveDraft() {
    if (!vendorId) {
      setError("Select Vendor");
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
      const { data: purData, error: purError } = await supabase
        .from("purchases")
        .insert([
          {
            vendor_id: vendorId,
            purchase_date: purchaseDate,
            terms,
            status: "DRAFT",
            // notes: notes
          },
        ])
        .select()
        .single();

      if (purError) throw purError;
      const purId = purData.id;

      const lineData = lines.map((l) => ({
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
      setNotes("");
      setSuccess(`Draft Created! ID: ${purId}`);
      navigate(`/purchases/${purId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePost(purId: string) {
    if (!confirm("Confirm POST?")) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("rpc_post_purchase", {
        p_purchase_id: purId,
      });
      if (error) throw error;
      setSuccess("Purchase POSTED!");
      navigate(`/purchases/${purId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

    return (
      <div className="relative">
        <div className="w-full space-y-6 pb-28">
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Purchases Management
            </h2>
            <span className="text-sm text-gray-500">
              Draft purchases await POST
            </span>
          </div>
          {error && <Alert variant="error" title="Kesalahan" description={error} />}
          {success && (
            <Alert variant="success" title="Berhasil" description={success} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-md border-gray-200">
                <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg text-purple-800">
                    New Purchase Order
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    <Select
                      label="Vendor"
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      options={[
                        { label: "-- Select --", value: "" },
                        ...vendors.map((v) => ({ label: v.name, value: v.id })),
                      ]}
                    />
                    <Input
                      label="Date"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                    <Select
                      label="Terms"
                      value={terms}
                      onChange={(e) => setTerms(e.target.value as any)}
                      options={[
                        { label: "CASH", value: "CASH" },
                        { label: "CREDIT", value: "CREDIT" },
                      ]}
                    />
                  </div>

                  <Textarea
                    label="Notes"
                    placeholder="Vendor reference number or internal notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />

                  <div className="my-6 border-b border-gray-100" />

                  <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                    <h4 className="font-semibold mb-3 text-sm text-purple-900 uppercase tracking-wide">
                      Add Item
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                      <div className="flex-grow">
                        <Select
                          label="Product"
                          value={selectedItemId}
                          onChange={(e) => {
                            const newItemId = e.target.value;
                            setSelectedItemId(newItemId);
                            const selectedItem = items.find(
                              (i) => i.id === newItemId,
                            );
                            if (selectedItem) {
                              setCostPrice(selectedItem.default_price_buy || 0);
                            }
                          }}
                          options={[
                            { label: "-- Select Item --", value: "" },
                            ...items.map((i) => ({
                              label: `${i.sku} - ${i.name}`,
                              value: i.id,
                            })),
                          ]}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          label="Qty"
                          type="number"
                          inputMode="numeric"
                          value={qty}
                          min={1}
                          onChange={(e) => setQty(parseQtyValue(e.target.value))}
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          label="Cost"
                          type="number"
                          inputMode="decimal"
                          value={costPrice}
                          min={0}
                          onChange={(e) =>
                            setCostPrice(parseCostValue(e.target.value))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={addItem}
                        className="w-full sm:w-auto min-h-[44px]"
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <Table>
                      <TableHead className="bg-gray-50">
                        <TableRow>
                          <TableHeader>Item</TableHeader>
                          <TableHeader>Qty</TableHeader>
                          <TableHeader>Cost</TableHeader>
                          <TableHeader>Subtotal</TableHeader>
                          <TableHeader>&nbsp;</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lines.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center text-gray-400 py-8 italic bg-gray-50/30"
                            >
                              No items in order
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
                    <div className="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-200">
                      <span className="font-bold text-gray-600 uppercase text-xs tracking-wider">
                        Total
                      </span>
                      <span className="font-bold text-2xl text-purple-600">
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
                      No pending drafts.
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {drafts.map((d) => (
                        <li
                          key={d.id}
                          className="p-4 border border-gray-100 rounded-lg hover:border-purple-300 hover:shadow-md transition-all bg-white"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-bold text-gray-900">
                                {d.vendor?.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Icons.Calendar className="w-3 h-3" />{" "}
                                {d.purchase_date}
                              </div>
                            </div>
                            <DocumentStatusBadge status="DRAFT" />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            <Button
                              type="button"
                              onClick={() => handlePost(d.id)}
                              disabled={loading}
                              className="w-full sm:w-auto min-h-[44px] bg-blue-600 hover:bg-blue-700"
                              icon={<Icons.Check className="w-4 h-4" />}
                            >
                              POST Purchase
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
        </div>
      </div>
    );
}
