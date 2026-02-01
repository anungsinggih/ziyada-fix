import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/Tabs";
import { Card, CardContent } from "./ui/Card";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { Icons } from "./ui/Icons";
import { useNavigate, useLocation } from "react-router-dom";

// Sub-components
import { FinanceARList } from "./FinanceARList";
import { FinanceAPList } from "./FinanceAPList";
import { FinanceReceiptForm } from "./FinanceReceiptForm";
import { FinancePaymentForm } from "./FinancePaymentForm";

export default function Finance() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<"AR" | "AP">("AR");

  // Shared Form State
  const [selectedId, setSelectedId] = useState("");
  const [selectedAmount, setSelectedAmount] = useState(0);

  // Payment Methods State (Shared)
  const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);
  const [methodError, setMethodError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const arId = params.get("ar");
    const apId = params.get("ap");

    if (arId) {
      setActiveTab("AR");
      selectFromQuery("AR", arId);
      return;
    }
    if (apId) {
      setActiveTab("AP");
      selectFromQuery("AP", apId);
    }
  }, [location.search]);

  async function selectFromQuery(type: "AR" | "AP", id: string) {
    setError(null);
    try {
      if (type === "AR") {
        const { data, error: fetchError } = await supabase
          .from("ar_invoices")
          .select("id, outstanding_amount")
          .eq("id", id)
          .single();
        if (fetchError) throw fetchError;
        setSelectedId(data.id);
        setSelectedAmount(data.outstanding_amount || 0);
      } else {
        const { data, error: fetchError } = await supabase
          .from("ap_bills")
          .select("id, outstanding_amount")
          .eq("id", id)
          .single();
        if (fetchError) throw fetchError;
        setSelectedId(data.id);
        setSelectedAmount(data.outstanding_amount || 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load document";
      setError(msg);
    }
  }

  async function fetchPaymentMethods() {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("code, name")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) {
      setMethodError("Gagal memuat metode pembayaran; gunakan default CASH/BANK.");
      setPaymentMethods([
        { code: "CASH", name: "Kas (Default)" },
        { code: "BANK", name: "Bank (Default)" },
      ]);
    } else {
      setMethodError(null);
      setPaymentMethods(data || []);
    }
  }

  function handleSelect(id: string, amount: number) {
    setSelectedId(id);
    setSelectedAmount(amount);
    setError(null);
    setSuccess(null);
  }

  function handleSuccess(msg: string) {
    setSuccess(msg);
    setSelectedId("");
    setSelectedAmount(0);
    setRefreshTrigger(prev => prev + 1); // Trigger List Refresh
  }

  function handleError(msg: string) {
    setError(msg);
  }

  return (
    <div className="w-full space-y-8">
      <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">
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
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as "AR" | "AP");
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
            <div className={`transition-all duration-300 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}>
              <FinanceARList
                selectedId={selectedId}
                onSelect={handleSelect}
                refreshTrigger={refreshTrigger}
              />
            </div>
            {selectedId && (
              <div className="lg:col-span-1">
                <FinanceReceiptForm
                  invoiceId={selectedId}
                  initialAmount={selectedAmount}
                  paymentMethods={paymentMethods}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="AP">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div className={`transition-all duration-300 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}>
              <FinanceAPList
                selectedId={selectedId}
                onSelect={handleSelect}
                refreshTrigger={refreshTrigger}
              />
            </div>
            {selectedId && (
              <div className="lg:col-span-1">
                <FinancePaymentForm
                  billId={selectedId}
                  initialAmount={selectedAmount}
                  paymentMethods={paymentMethods}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
