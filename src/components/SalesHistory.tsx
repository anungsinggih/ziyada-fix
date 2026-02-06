import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
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
import { StatusBadge } from "./ui/StatusBadge";
import { Badge } from "./ui/Badge";
import { CustomerBadge } from "./ui/CustomerBadge";
import { Icons } from './ui/Icons'
import { ResponsiveTable } from './ui/ResponsiveTable';
import { EmptyState } from "./ui/EmptyState";
import { formatCurrency, formatDate, safeDocNo } from "../lib/format";
import { usePagination } from "../hooks/usePagination";
import { Pagination } from "./ui/Pagination";
import { PageHeader } from "./ui/PageHeader";
import { Section } from "./ui/Section";

type SalesRecord = {
  id: string;
  sales_date: string;
  sales_no: string | null;
  customer_id: string;
  customer_name: string;
  customer_type: string;
  terms: "CASH" | "CREDIT";
  total_amount: number;
  status: "DRAFT" | "POSTED" | "VOID";
  created_at: string;
};

export default function SalesHistory() {
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "POSTED" | "VOID">("ALL");
  const [termsFilter, setTermsFilter] = useState<"ALL" | "CASH" | "CREDIT">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const navigate = useNavigate();

  const { page, setPage, pageSize, range } = usePagination();
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, termsFilter, dateFrom, dateTo, setPage]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let query = supabase
        .from("sales")
        .select(
          `
                    id,
                    sales_date,
                    sales_no,
                    customer_id,
                    terms,
                    total_amount,
                    status,
                    created_at,
                    customers (
                        name,
                        customer_type
                    )
                `,
          { count: "exact" }
        )
        .order("sales_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }
      if (termsFilter !== "ALL") {
        query = query.eq("terms", termsFilter);
      }
      if (dateFrom) {
        query = query.gte("sales_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("sales_date", dateTo);
      }
      if (search.trim()) {
        const q = search.trim();
        query = query.or(`sales_no.ilike.%${q}%,customers.name.ilike.%${q}%`);
      }

      query = query.range(range[0], range[1]);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const enriched =
        data?.map((sale) => ({
          ...sale,
          customer_name: (sale.customers as unknown as { name: string })?.name || "Unknown",
          customer_type: (sale.customers as unknown as { customer_type: string })?.customer_type || "UMUM",
        })) || [];

      setSales(enriched);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to fetch sales");
      } else if (err && typeof err === "object" && "message" in err) {
        setError(String((err as { message?: string }).message || "Failed to fetch sales"));
      } else {
        setError("Failed to fetch sales");
      }
    } finally {
      setLoading(false);
    }
  }, [range, search, statusFilter, termsFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  async function handlePost(saleId: string) {
    if (
      !confirm(
        "Are you sure you want to POST this sales? This action cannot be undone.",
      )
    ) {
      return;
    }

    setPostingId(saleId);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } = await supabase.rpc("rpc_post_sales", {
        p_sales_id: saleId,
      });

      if (rpcError) {
        if (rpcError.message?.includes("CLOSED")) {
          throw new Error("Cannot POST: Period is CLOSED for this date");
        } else if (rpcError.message?.includes("stock")) {
          throw new Error("Insufficient stock for one or more items");
        } else {
          throw rpcError;
        }
      }

      setSuccess("Sales posted successfully!");
      navigate(`/sales/${saleId}`);
    } catch (err: unknown) {
      setSuccess(null);
      if (err instanceof Error) {
        setError(err.message || "Failed to post sales");
      } else if (err && typeof err === "object" && "message" in err) {
        setError(String((err as { message?: string }).message || "Failed to post sales"));
      } else {
        setError("Failed to post sales");
      }
    } finally {
      setPostingId(null);
    }
  }

  if (loading) {
    return (
      <div className="w-full p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading sales...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20">
      <PageHeader
        title="Sales History"
        description="View and manage sales transactions."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Sales" }]}
        actions={
          <div className="flex gap-2">
            <Button
              onClick={fetchSales}
              variant="outline"
              icon={<Icons.Refresh className="w-4 h-4" />}
            >
              Refresh
            </Button>
            <Button
              onClick={() => navigate("/sales")}
              icon={<Icons.Plus className="w-4 h-4" />}
            >
              New Sales
            </Button>
          </div>
        }
      />

      {error && <Alert variant="error" title="Kesalahan" description={error} />}
      {success && (
        <Alert variant="success" title="Sukses" description={success} />
      )}

      <Section
        title="Filter Sales"
        description="Search and filter transactions."
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <Input
              label="Search"
              placeholder="Doc No / Customer"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              containerClassName="!mb-0"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "DRAFT" | "POSTED" | "VOID")}
              options={[
                { label: "All Status", value: "ALL" },
                { label: "Draft", value: "DRAFT" },
                { label: "Posted", value: "POSTED" },
                { label: "Void", value: "VOID" },
              ]}
              className="!mb-0"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <Select
              label="Terms"
              value={termsFilter}
              onChange={(e) => setTermsFilter(e.target.value as "ALL" | "CASH" | "CREDIT")}
              options={[
                { label: "All Terms", value: "ALL" },
                { label: "Cash", value: "CASH" },
                { label: "Credit", value: "CREDIT" },
              ]}
              className="!mb-0"
            />
          </div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-4 flex gap-2">
            <Input
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              containerClassName="!mb-0 w-full"
            />
            <Input
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              containerClassName="!mb-0 w-full"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-1">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setTermsFilter("ALL");
                setDateFrom("");
                setDateTo("");
              }}
              icon={<Icons.Close className="w-4 h-4" />}
              title="Clear Filters"
            >
              Clear
            </Button>
          </div>
        </div>
      </Section>

      <Card>
        <CardHeader>
          <CardTitle>Sales List ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>


          {sales.length === 0 ? (
            <EmptyState
              icon={<Icons.FileText className="w-5 h-5" />}
              title="No sales records found"
              description="Create your first sale to get started"
            />
          ) : (
            <ResponsiveTable minWidth="640px">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Doc No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDate(sale.sales_date)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {safeDocNo(sale.sales_no, sale.id)}
                      </TableCell>
                      <TableCell>
                        <CustomerBadge name={sale.customer_name} customerType={sale.customer_type} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            sale.terms === "CASH"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }
                        >
                          {sale.terms}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.total_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={sale.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => navigate(`/sales/${sale.id}`)}
                            icon={<Icons.Eye className="w-4 h-4" />}
                            aria-label="View sales"
                            title="View"
                          />
                          {sale.status === "DRAFT" && (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => navigate(`/sales/${sale.id}/edit`)}
                                icon={<Icons.Edit className="w-4 h-4" />}
                                className="w-full sm:w-auto"
                                aria-label="Edit sales"
                                title="Edit"
                              />
                              <Button
                                size="sm"
                                onClick={() => handlePost(sale.id)}
                                disabled={postingId === sale.id}
                                isLoading={postingId === sale.id}
                                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                                icon={<Icons.Check className="w-4 h-4" />}
                              >
                                POST
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={page}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
                isLoading={loading}
              />
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
