import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/Tabs";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/Table";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Alert } from "./ui/Alert";
import { Switch } from "./ui/Switch";
import { Icons } from "./ui/Icons";
import { useNavigate } from "react-router-dom";

type AR = {
  id: string;
  invoice_date: string;
  customer: { name: string };
  total_amount: number;
  outstanding_amount: number;
  status: string;
};

type AP = {
  id: string;
  bill_date: string;
  vendor: { name: string };
  total_amount: number;
  outstanding_amount: number;
  status: string;
};

export default function Finance() {
  // const [tab, setTab] = useState<'AR' | 'AP'>('AR') // Controlled by Tabs component now
  const [arList, setArList] = useState<AR[]>([]);
  const [apList, setApList] = useState<AP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPettyCash, setIsPettyCash] = useState(false);

  // Form
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState(0);
  const [trxDate, setTrxDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [method, setMethod] = useState("CASH");
  const [paymentMethods, setPaymentMethods] = useState<
    { code: string; name: string }[]
  >([]);
  const [methodError, setMethodError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Since tabs control visibility, we might need separate effects or just load both.
  // Or load on tab change if we controlled it.
  // Let's load both initially for simplicity or stick to effect.
  // Ideally we want to refresh when success happens.

  useEffect(() => {
    fetchAR();
    fetchAP();
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    if (success) {
      fetchAR();
      fetchAP();
    }
  }, [success]);

  useEffect(() => {
    if (paymentMethods.length) {
      setMethod((prev) =>
        paymentMethods.some((m) => m.code === prev)
          ? prev
          : paymentMethods[0].code,
      );
    }
  }, [paymentMethods]);

  useEffect(() => {
    if (isPettyCash && method !== "CASH") {
      setMethod("CASH");
    }
  }, [isPettyCash, method]);

  async function fetchAR() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ar_invoices")
      .select("*, customer:customers(name)")
      .gt("outstanding_amount", 0)
      .order("invoice_date", { ascending: true });

    if (error) setError(error.message);
    else setArList(data || []);
    setLoading(false);
  }

  async function fetchAP() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ap_bills")
      .select("*, vendor:vendors(name)")
      .gt("outstanding_amount", 0)
      .order("bill_date", { ascending: true });

    if (error) setError(error.message);
    else setApList(data || []);
    setLoading(false);
  }

  async function fetchPaymentMethods() {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("code, name")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) {
      setMethodError(
        "Gagal memuat metode pembayaran; gunakan default CASH/BANK.",
      );
      setPaymentMethods([
        { code: "CASH", name: "Kas (Default)" },
        { code: "BANK", name: "Bank (Default)" },
      ]);
    } else {
      setMethodError(null);
      setPaymentMethods(data || []);
    }
  }

  function handleSelect(id: string, outstanding: number) {
    setSelectedId(id);
    setAmount(outstanding);
    setError(null);
    setSuccess(null);
  }

  function handleAmountChange(value: string) {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      setAmount(0);
      return;
    }

    if (isPettyCash) {
      setAmount(Math.min(parsed, 500000));
    } else {
      setAmount(parsed);
    }
  }

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  async function handleSubmit(type: "AR" | "AP") {
    if (!selectedId) return;
    if (amount <= 0) {
      setError("Amount must be > 0");
      return;
    }

    const normalizedMethod = (method || "CASH").toUpperCase();

    if (isPettyCash && normalizedMethod !== "CASH") {
      setError("Petty cash receipts must use CASH method");
      return;
    }

    if (isPettyCash && amount > 500000) {
      setError("Petty cash receipts limited to 500.000");
      return;
    }

    setMethod(normalizedMethod);

    setLoading(true);
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (type === "AR") {
        const { error } = await supabase.rpc("rpc_create_receipt_ar", {
          p_ar_invoice_id: selectedId,
          p_amount: amount,
          p_receipt_date: trxDate,
          p_method: normalizedMethod,
          p_is_petty_cash: isPettyCash,
        });
        if (error) throw error;
        setSuccess("Receipt Created Successfully!");
      } else {
        const { error } = await supabase.rpc("rpc_create_payment_ap", {
          p_ap_bill_id: selectedId,
          p_amount: amount,
          p_payment_date: trxDate,
          p_method: method,
        });
        if (error) throw error;
        setSuccess("Payment Created Successfully!");
      }
      setSelectedId("");
      setAmount(0);
    } catch (err: unknown) {
      setSuccess(null);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
      setLoading(false);
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
    <div className="w-full space-y-8">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900">
        Finance & Cash Flow
      </h2>

      <Card className="border border-blue-200 bg-blue-50/60 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              Need to reverse vendor purchases?
            </p>
            <p className="text-xs text-blue-900/80">
              Purchase returns automatically correct stock, AP, and COGS. Use
              the dedicated return flow when goods go back.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/purchase-return")}
          >
            Go to Purchase Returns
          </Button>
        </CardContent>
      </Card>

      {methodError && (
        <Alert
          variant="warning"
          title="Metode pembayaran"
          description={methodError}
        />
      )}
      {error && <Alert variant="error" title="Kesalahan" description={error} />}
      {success && (
        <Alert variant="success" title="Berhasil" description={success} />
      )}

      <Tabs
        defaultValue="AR"
        onValueChange={() => {
          setSelectedId("");
          setSuccess(null);
          setError(null);
        }}
      >
        <div className="flex flex-col gap-2 mb-8">
          <TabsList className="flex flex-wrap gap-2 overflow-x-auto w-full rounded-lg bg-white border border-gray-100 shadow-sm p-1">
            <TabsTrigger
              value="AR"
              className="min-w-[140px] flex-1 sm:flex-auto flex items-center gap-2 justify-center"
            >
              <Icons.ArrowDown className="w-4 h-4 text-green-600" /> Incoming
            </TabsTrigger>
            <TabsTrigger
              value="AP"
              className="min-w-[140px] flex-1 sm:flex-auto flex items-center gap-2 justify-center"
            >
              <Icons.ArrowUp className="w-4 h-4 text-red-600" /> Outgoing
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="AR">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div
              className={`transition-all duration-300 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}
            >
              <Card className="shadow-sm">
                <CardHeader className="bg-green-50/50 border-b border-green-100">
                  <CardTitle className="text-green-800">
                    Outstanding Invoices (Receivables)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto w-full">
                    <Table className="w-full min-w-[640px]">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Date</TableHeader>
                          <TableHeader>Customer</TableHeader>
                          <TableHeader>Total</TableHeader>
                          <TableHeader>Outstanding</TableHeader>
                          <TableHeader>Action</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {arList.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center italic py-8 text-gray-500"
                            >
                              No outstanding invoices
                            </TableCell>
                          </TableRow>
                        ) : (
                          arList.map((item) => (
                            <TableRow
                              key={item.id}
                              className={
                                selectedId === item.id ? "bg-blue-50" : ""
                              }
                            >
                              <TableCell>{item.invoice_date}</TableCell>
                              <TableCell className="font-medium">
                                {item.customer?.name}
                              </TableCell>
                              <TableCell>
                                {item.total_amount.toLocaleString()}
                              </TableCell>
                              <TableCell className="font-bold text-green-600">
                                {item.outstanding_amount.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={
                                    selectedId === item.id
                                      ? "primary"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    handleSelect(
                                      item.id,
                                      item.outstanding_amount,
                                    )
                                  }
                                  className="w-full sm:w-auto"
                                >
                                  {selectedId === item.id
                                    ? "Selected"
                                    : "Select"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
            {selectedId && (
              <div className="lg:col-span-1">
                <Card className="border-green-200 shadow-md sticky top-6">
                  <CardHeader className="bg-green-100/50 border-b border-green-100">
                    <CardTitle className="text-green-900">
                      Process Receipt
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="text-xs text-gray-500 font-mono mb-2">
                      REF: {selectedId}
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
                      value={amount}
                      max={isPettyCash ? 500000 : undefined}
                      onChange={(e) => handleAmountChange(e.target.value)}
                    />
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
                      onClick={() => handleSubmit("AR")}
                      disabled={loading || submitting}
                      isLoading={submitting}
                    >
                      Confirm Receipt
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="AP">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div
              className={`transition-all duration-300 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}
            >
              <Card className="shadow-sm">
                <CardHeader className="bg-red-50/50 border-b border-red-100">
                  <CardTitle className="text-red-800">
                    Unpaid Bills (Payables)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto w-full">
                    <Table className="w-full min-w-[640px]">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Date</TableHeader>
                          <TableHeader>Vendor</TableHeader>
                          <TableHeader>Total</TableHeader>
                          <TableHeader>Outstanding</TableHeader>
                          <TableHeader>Action</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {apList.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center italic py-8 text-gray-500"
                            >
                              No unpaid bills
                            </TableCell>
                          </TableRow>
                        ) : (
                          apList.map((item) => (
                            <TableRow
                              key={item.id}
                              className={
                                selectedId === item.id ? "bg-red-50" : ""
                              }
                            >
                              <TableCell>{item.bill_date}</TableCell>
                              <TableCell className="font-medium">
                                {item.vendor?.name}
                              </TableCell>
                              <TableCell>
                                {item.total_amount.toLocaleString()}
                              </TableCell>
                              <TableCell className="font-bold text-red-600">
                                {item.outstanding_amount.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={
                                    selectedId === item.id
                                      ? "primary"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    handleSelect(
                                      item.id,
                                      item.outstanding_amount,
                                    )
                                  }
                                  className="w-full sm:w-auto"
                                >
                                  {selectedId === item.id
                                    ? "Selected"
                                    : "Select"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
            {selectedId && (
              <div className="lg:col-span-1">
                <Card className="border-red-200 shadow-md sticky top-6">
                  <CardHeader className="bg-red-100/50 border-b border-red-100">
                    <CardTitle className="text-red-900">
                      Process Payment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="text-xs text-gray-500 font-mono mb-2">
                      REF: {selectedId}
                    </div>
                    <Input
                      label="Date"
                      type="date"
                      value={trxDate}
                      onChange={(e) => setTrxDate(e.target.value)}
                    />
                    <Input
                      label="Amount Paid"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value))}
                    />
                    <Select
                      label="Method"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      options={methodOptions}
                    />
                    <Button
                      className="w-full mt-4 bg-red-600 hover:bg-red-700"
                      onClick={() => handleSubmit("AP")}
                      disabled={loading || submitting}
                      isLoading={submitting}
                    >
                      Confirm Payment
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Summary cards and receipt list removed per request */}
    </div>
  );
}
