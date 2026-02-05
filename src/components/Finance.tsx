import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { PageHeader } from "./ui/PageHeader";
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

  // Handle Tab Change to reset selection
  function handleTabChange(tab: "AR" | "AP") {
    setActiveTab(tab);
    setSelectedId("");
    setSuccess(null);
    setError(null);
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <PageHeader
        title="Finance & Cash Flow"
        description="Monitor outstanding invoices, pay bills, and manage cash flow."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Finance' }]}
        actions={
          <Button
            variant="outline"
            className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
            onClick={() => navigate("/purchase-return")}
            icon={<Icons.RotateCcw className="w-4 h-4" />}
          >
            Purchase Returns
          </Button>
        }
      />

      <Card className="border border-blue-200/60 bg-blue-50/40 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10 p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-lg shrink-0 text-blue-600 mt-1">
              <Icons.Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-900">
                Quick Tip: Purchase Returns
              </p>
              <p className="text-sm text-blue-700/80 max-w-2xl">
                Returns automatically correct stock levels, AP balances, and COGS logic.
                Always use the dedicated return flow rather than manual adjustments.
              </p>
            </div>
          </div>

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

      {/* Pill Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100/50 rounded-xl mb-8 overflow-x-auto no-scrollbar border border-slate-200/50 w-fit">
        <button
          onClick={() => handleTabChange("AR")}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${activeTab === "AR" ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"}`}
        >
          <Icons.ArrowDown className={`w-4 h-4 ${activeTab === 'AR' ? 'text-indigo-600' : 'text-slate-400'}`} />
          Incoming (Receivables)
        </button>
        <button
          onClick={() => handleTabChange("AP")}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${activeTab === "AP" ? "bg-white text-rose-600 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"}`}
        >
          <Icons.ArrowUp className={`w-4 h-4 ${activeTab === 'AP' ? 'text-rose-600' : 'text-slate-400'}`} />
          Outgoing (Payables)
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "AR" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className={`transition-all duration-300 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}>
              <FinanceARList
                selectedId={selectedId}
                onSelect={handleSelect}
                refreshTrigger={refreshTrigger}
              />
            </div>
            {selectedId && (
              <div className="lg:col-span-1 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="sticky top-6">
                  <FinanceReceiptForm
                    invoiceId={selectedId}
                    initialAmount={selectedAmount}
                    paymentMethods={paymentMethods}
                    onSuccess={handleSuccess}
                    onError={handleError}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "AP" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className={`transition-all duration-300 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}>
              <FinanceAPList
                selectedId={selectedId}
                onSelect={handleSelect}
                refreshTrigger={refreshTrigger}
              />
            </div>
            {selectedId && (
              <div className="lg:col-span-1 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="sticky top-6">
                  <FinancePaymentForm
                    billId={selectedId}
                    initialAmount={selectedAmount}
                    paymentMethods={paymentMethods}
                    onSuccess={handleSuccess}
                    onError={handleError}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
