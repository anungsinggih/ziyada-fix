import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";
import { Alert } from "./ui/Alert";
import { Icons } from "./ui/Icons";
import { formatCurrency } from "../lib/format";
import { getErrorMessage } from "../lib/errors";

type CustomerDetailData = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  customer_type: "UMUM" | "KHUSUS" | "CUSTOM";
  is_active: boolean;
};

type SalesRow = {
  id: string;
  sales_no: string | null;
  sales_date: string | null;
  status: string;
  total_amount: number | null;
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerDetailData | null>(null);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lifetimeValue, setLifetimeValue] = useState(0);
  const [outstanding, setOutstanding] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchDetail(id);
  }, [id]);

  async function fetchDetail(customerId: string) {
    setLoading(true);
    setError(null);
    try {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id,name,phone,address,customer_type,is_active")
        .eq("id", customerId)
        .single();
      if (customerError) throw customerError;
      setCustomer(customerData);

      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("id,sales_no,sales_date,status,total_amount")
        .eq("customer_id", customerId)
        .order("sales_date", { ascending: false })
        .limit(20);
      if (salesError) throw salesError;
      setSales((salesData || []) as SalesRow[]);

      const { data: lifetimeRows, error: lifetimeError } = await supabase
        .from("sales")
        .select("total_amount,status")
        .eq("customer_id", customerId)
        .eq("status", "POSTED");
      if (lifetimeError) throw lifetimeError;
      const lifetime = (lifetimeRows || []).reduce(
        (sum: number, row: { total_amount: number | null }) =>
          sum + (row.total_amount || 0),
        0
      );
      setLifetimeValue(lifetime);

      const { data: arData, error: arError } = await supabase
        .from("ar_invoices")
        .select("outstanding_amount,status")
        .eq("customer_id", customerId);
      if (!arError) {
        const arOutstanding = (arData || [])
          .filter((row: { status: string }) => row.status !== "PAID")
          .reduce(
            (sum: number, row: { outstanding_amount: number | null }) =>
              sum + (row.outstanding_amount || 0),
            0
          );
        setOutstanding(arOutstanding);
      } else {
        setOutstanding(null);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!id) {
    return <Alert variant="error" title="Error" description="Customer ID not found." />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/customers")}>
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{customer?.name || "Customer Detail"}</h2>
            {customer && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Badge variant={customer.is_active ? "success" : "secondary"}>
                  {customer.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant={customer.customer_type === "CUSTOM" ? "warning" : "secondary"}>
                  {customer.customer_type}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <Button onClick={() => navigate(`/sales?customer=${id}`)} icon={<Icons.Cart className="w-4 h-4" />}>
          Create Sale
        </Button>
      </div>

      {error && <Alert variant="error" title="Error" description={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Lifetime Sales</div>
            <div className="text-2xl font-semibold">{formatCurrency(lifetimeValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Outstanding AR</div>
            <div className="text-2xl font-semibold">
              {outstanding === null ? "-" : formatCurrency(outstanding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Total Transactions</div>
            <div className="text-2xl font-semibold">{sales.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-100">
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Phone</div>
                <div className="font-medium">{customer?.phone || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">Address</div>
                <div className="font-medium">{customer?.address || "-"}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-100">
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400">
                      No transactions
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/sales/${row.id}`)}
                    >
                      <TableCell className="font-medium">{row.sales_no || row.id}</TableCell>
                      <TableCell>{row.sales_date || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "POSTED" ? "success" : "secondary"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.total_amount || 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
