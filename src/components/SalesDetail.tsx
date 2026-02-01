import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
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
import { Badge } from "./ui/Badge";
import { Alert } from "./ui/Alert";
import { Icons } from "./ui/Icons";
import RelatedDocumentsCard, { type RelatedDocumentItem } from "./shared/RelatedDocumentsCard";

type SalesDetail = {
  id: string;
  sales_date: string;
  sales_no: string | null;
  customer_id: string;
  customer_name: string;
  terms: "CASH" | "CREDIT";
  payment_method_code?: string | null;
  total_amount: number;
  status: "DRAFT" | "POSTED" | "VOID";
  notes: string | null;
  created_at: string;
};

type SalesItem = {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  uom_snapshot: string;
  qty: number;
  unit_price: number;
  subtotal: number;
};

type RelatedDoc = {
  journal_id?: string;
  journal_date?: string;
  receipt_id?: string;
  receipt_amount?: number;
  ar_invoice_id?: string;
  ar_total?: number;
  ar_outstanding?: number;
  ar_status?: string;
};

type CompanyProfile = {
  name: string;
  address: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
};

export default function SalesDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<SalesDetail | null>(null);
  const [items, setItems] = useState<SalesItem[]>([]);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc>({});
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [paymentMethodName, setPaymentMethodName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSaleDetail(id);
      fetchCompanyProfile();
    }
  }, [id]);

  async function fetchSaleDetail(saleId: string) {
    setLoading(true);
    setError(null);

    try {
      // Fetch header
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .select(
          `
                    id,
                    sales_date,
                    sales_no,
                    customer_id,
                    terms,
                    payment_method_code,
                    total_amount,
                    status,
                    notes,
                    created_at,
                    customers (
                        name
                    )
                `,
        )
        .eq("id", saleId)
        .single();

      if (saleError) throw saleError;

      setSale({
        ...saleData,
        customer_name: (saleData.customers as unknown as { name: string })?.name || "Unknown",
      });

      if (saleData.terms === "CASH" && saleData.payment_method_code) {
        const { data: methodData } = await supabase
          .from("payment_methods")
          .select("name")
          .eq("code", saleData.payment_method_code)
          .single();
        setPaymentMethodName(methodData?.name || saleData.payment_method_code);
      } else {
        setPaymentMethodName(null);
      }

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from("sales_items")
        .select(
          `
                    id,
                    item_id,
                    qty,
                    unit_price,
                    subtotal,
                    uom_snapshot,
                    items (
                        name,
                        sku
                    )
                `,
        )
        .eq("sales_id", saleId);

      if (itemsError) throw itemsError;

      setItems(
        itemsData?.map((item) => ({
          ...item,
          item_name: (item.items as unknown as { name: string })?.name || "Unknown",
          sku: (item.items as unknown as { sku: string })?.sku || "",
        })) || [],
      );

      // Fetch related documents (only if POSTED)
      if (saleData.status === "POSTED") {
        const related: RelatedDoc = {};

        // Journal
        const { data: journalData } = await supabase
          .from("journals")
          .select("id, journal_date")
          .eq("ref_type", "sales")
          .eq("ref_id", saleId)
          .single();

        if (journalData) {
          related.journal_id = journalData.id;
          related.journal_date = journalData.journal_date;
        }

        // Receipt (if CASH)
        if (saleData.terms === "CASH") {
          const { data: receiptData } = await supabase
            .from("receipts")
            .select("id, amount")
            .eq("ref_type", "sales")
            .eq("ref_id", saleId)
            .single();

          if (receiptData) {
            related.receipt_id = receiptData.id;
            related.receipt_amount = receiptData.amount;
          }
        }

        // AR Invoice (if CREDIT)
        if (saleData.terms === "CREDIT") {
          const { data: arData } = await supabase
            .from("ar_invoices")
            .select("id, total_amount, outstanding_amount, status")
            .eq("sales_id", saleId)
            .single();

          if (arData) {
            related.ar_invoice_id = arData.id;
            related.ar_total = arData.total_amount;
            related.ar_outstanding = arData.outstanding_amount;
            related.ar_status = arData.status;
          }
        }

        setRelatedDocs(related);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Failed to fetch sales detail");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompanyProfile() {
    const { data } = await supabase
      .from("company_profile")
      .select("*")
      .single();
    if (data) setCompany(data);
  }

  async function handleDeleteDraft() {
    if (!sale) return;
    if (!confirm("Hapus draft ini? Tindakan ini tidak bisa dibatalkan."))
      return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await supabase.rpc("rpc_delete_sales_draft", {
        p_sales_id: sale.id,
      });
      if (error) throw error;
      setDeleteSuccess("Draft berhasil dihapus, kembali ke daftar...");
      setTimeout(() => navigate("/sales/history"), 700);
    } catch (err: unknown) {
      if (err instanceof Error) setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getStatusBadge(status: string) {
    const colors = {
      DRAFT: "bg-gray-100 text-gray-800",
      POSTED: "bg-green-100 text-green-800",
      VOID: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={colors[status as keyof typeof colors] || "bg-gray-100"}>
        {status}
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className="w-full p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading sales detail...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="w-full p-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
          <Icons.Warning className="w-5 h-5 flex-shrink-0" />{" "}
          {error || "Sales not found"}
        </div>
        <Button
          onClick={() => navigate("/sales/history")}
          className="mt-4"
          icon={<Icons.ArrowLeft className="w-4 h-4" />}
        >
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 print:hidden">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Sales Detail
        </h2>
        <div className="flex gap-2 no-print flex-wrap">
          <Button
            onClick={() => window.print()}
            variant="outline"
            icon={<Icons.Printer className="w-4 h-4" />}
          >
            Print
          </Button>
          <Button
            onClick={() => navigate("/sales/history")}
            variant="outline"
            icon={<Icons.ArrowLeft className="w-4 h-4" />}
          >
            Back to List
          </Button>
          {sale.status === "DRAFT" && (
            <Button
              onClick={() => navigate(`/sales/${sale.id}/edit`)}
              icon={<Icons.Edit className="w-4 h-4" />}
            >
              Edit
            </Button>
          )}
          {sale.status === "DRAFT" && (
            <Button
              variant="danger"
              onClick={handleDeleteDraft}
              isLoading={isDeleting}
              disabled={isDeleting}
            >
              Delete Draft
            </Button>
          )}
        </div>
        {(deleteError || deleteSuccess) && (
          <div className="w-full">
            {deleteError && (
              <Alert variant="error" title="Gagal" description={deleteError} />
            )}
            {deleteSuccess && (
              <Alert
                variant="success"
                title="Berhasil"
                description={deleteSuccess}
              />
            )}
          </div>
        )}
      </div>

      {/* Print Logo */}
      {/* Header Card */}
      <Card className="print:hidden">
        <CardHeader className="bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Sales Document</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {sale.sales_no || `ID: ${sale.id.substring(0, 8)}`}
              </p>
            </div>
            {getStatusBadge(sale.status)}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Date</p>
              <p className="font-medium">
                {new Date(sale.sales_date).toLocaleDateString("id-ID")}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Customer</p>
              <p className="font-medium">{sale.customer_name}</p>
            </div>
            <div>
              <p className="text-gray-600">Terms</p>
              <p className="font-medium">
                <Badge
                  className={
                    sale.terms === "CASH"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-orange-100 text-orange-800"
                  }
                >
                  {sale.terms}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-gray-600">Total</p>
              <p className="font-bold text-lg">
                {formatCurrency(sale.total_amount)}
              </p>
            </div>
          </div>
          {sale.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-gray-600 text-sm">Notes</p>
              <p className="text-sm mt-1">{sale.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">
                    {item.sku}
                  </TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.uom_snapshot}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.subtotal)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-gray-50 font-bold border-t-2">
                <TableCell colSpan={5} className="text-right">
                  TOTAL:
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(sale.total_amount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Related Documents (POSTED only) */}
      {sale.status === "POSTED" && (
        <RelatedDocumentsCard
          items={[
            ...(relatedDocs.journal_id
              ? [
                {
                  id: relatedDocs.journal_id,
                  title: "Journal Entry",
                  description: (
                    <p>
                      ID: {relatedDocs.journal_id.substring(0, 8)} | Date:{" "}
                      {new Date(relatedDocs.journal_date!).toLocaleDateString(
                        "id-ID",
                      )}
                    </p>
                  ),
                  icon: <Icons.FileText className="w-5 h-5" />,
                  toneClassName: "bg-blue-50",
                  iconClassName: "text-blue-500",
                  actionLabel: "Open",
                  onAction: () =>
                    navigate(
                      `/journals?q=${encodeURIComponent(
                        sale.sales_no || relatedDocs.journal_id!
                      )}`
                    ),
                } as RelatedDocumentItem,
              ]
              : []),
            ...(relatedDocs.receipt_id
              ? [
                {
                  id: relatedDocs.receipt_id,
                  title: "Receipt (CASH)",
                  description: (
                    <p>
                      ID: {relatedDocs.receipt_id.substring(0, 8)} | Amount:{" "}
                      {formatCurrency(relatedDocs.receipt_amount!)}
                    </p>
                  ),
                  icon: <Icons.DollarSign className="w-5 h-5" />,
                  toneClassName: "bg-green-50",
                  iconClassName: "text-green-500",
                } as RelatedDocumentItem,
              ]
              : []),
            ...(relatedDocs.ar_invoice_id
              ? [
                {
                  id: relatedDocs.ar_invoice_id,
                  title: "AR Invoice (CREDIT)",
                  description: (
                    <p>
                      ID: {relatedDocs.ar_invoice_id.substring(0, 8)} | Total:{" "}
                      {formatCurrency(relatedDocs.ar_total!)} | Outstanding:{" "}
                      {formatCurrency(relatedDocs.ar_outstanding!)} | Status:{" "}
                      <Badge className="ml-1">{relatedDocs.ar_status}</Badge>
                    </p>
                  ),
                  icon: <Icons.FileText className="w-5 h-5" />,
                  toneClassName: "bg-orange-50",
                  iconClassName: "text-orange-500",
                  actionLabel: "Open AR",
                  onAction: () =>
                    navigate(
                      `/finance?ar=${encodeURIComponent(
                        relatedDocs.ar_invoice_id!
                      )}`
                    ),
                } as RelatedDocumentItem,
              ]
              : []),
          ]}
        />
      )}

      {/* --- PRINT ONLY SECTION --- */}
      <div className="hidden print:block font-sans text-sm text-gray-900 leading-relaxed">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
          <div>
            <img src="/logo.png" alt="Logo" className="h-12 w-auto mb-3" />
            <h1 className="text-xl font-bold uppercase tracking-wide">
              {company?.name || "Company Name"}
            </h1>
            <div className="mt-1 text-xs text-gray-600 space-y-0.5">
              <p>{company?.address}</p>
              <p>
                Phone: {company?.phone} | Email: {company?.email}
              </p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              INVOICE
            </h2>
            <div className="mt-4 space-y-1">
              <p>
                <span className="font-semibold text-gray-500 w-24 inline-block text-xs uppercase">
                  Invoice #
                </span>{" "}
                <span className="font-mono font-bold text-lg">
                  {sale.sales_no || sale.id.substring(0, 8)}
                </span>
              </p>
              <p>
                <span className="font-semibold text-gray-500 w-24 inline-block text-xs uppercase">
                  Date
                </span>{" "}
                {new Date(sale.sales_date).toLocaleDateString("id-ID")}
              </p>
              <p>
                <span className="font-semibold text-gray-500 w-24 inline-block text-xs uppercase">
                  Due Date
                </span>{" "}
                {new Date(sale.sales_date).toLocaleDateString("id-ID")}
              </p>
            </div>
          </div>
        </div>

        {/* Bill To & Info */}
        <div className="flex justify-between mb-8 gap-8">
          <div className="w-1/2">
            <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">
              Bill To
            </h3>
            <p className="font-bold text-lg">{sale.customer_name}</p>
            <p className="text-gray-600 mt-1">
              Customer ID: {sale.customer_id.substring(0, 8)}
            </p>
          </div>
          <div className="w-1/2 text-right">
            {/* Payment Status / Terms */}
            <div className="inline-block bg-gray-50 p-4 rounded border border-gray-200 text-left min-w-[200px]">
              <p className="text-xs uppercase font-bold text-gray-500 mb-1">
                Payment Method
              </p>
              <p className="font-bold text-lg mb-2">
                {sale.terms === "CASH"
                  ? paymentMethodName || sale.payment_method_code || "CASH"
                  : sale.terms}
              </p>
              <p className="text-xs uppercase font-bold text-gray-500 mb-1">
                Status
              </p>
              <Badge
                className={
                  sale.status === "POSTED"
                    ? "bg-black text-white"
                    : "bg-gray-200 text-gray-800"
                }
              >
                {sale.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Items Table (Clean) */}
        <div className="mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-y border-gray-300">
                <th className="py-2 px-2 font-bold text-xs uppercase text-gray-600">
                  No
                </th>
                <th className="py-2 px-2 font-bold text-xs uppercase text-gray-600">
                  Description
                </th>
                <th className="py-2 px-2 font-bold text-xs uppercase text-gray-600 text-right">
                  Qty
                </th>
                <th className="py-2 px-2 font-bold text-xs uppercase text-gray-600 text-right">
                  Unit Price
                </th>
                <th className="py-2 px-2 font-bold text-xs uppercase text-gray-600 text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td className="py-2 px-2 text-xs text-gray-500">{i + 1}</td>
                  <td className="py-2 px-2">
                    <div className="font-bold">{item.item_name}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {item.sku} {item.uom_snapshot && `(${item.uom_snapshot})`}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-mono">{item.qty}</td>
                  <td className="py-2 px-2 text-right font-mono text-gray-600">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-2 px-2 text-right font-bold font-mono">
                    {formatCurrency(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800">
                <td
                  colSpan={4}
                  className="py-3 px-2 text-right font-bold uppercase text-gray-600 text-xs"
                >
                  Total Amount
                </td>
                <td className="py-3 px-2 text-right font-extrabold text-xl">
                  {formatCurrency(sale.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Section */}
        <div className="grid grid-cols-2 gap-12 mt-12 pt-4 border-t border-gray-200 page-break-inside-avoid">
          <div>
            <h4 className="font-bold text-xs uppercase text-gray-500 mb-2">
              Payment Instructions
            </h4>
            <div className="text-sm bg-blue-50/50 p-3 rounded border border-blue-100">
              <p className="font-bold text-blue-900">
                {company?.bank_name || "Bank Name"}
              </p>
              <p className="font-mono text-lg">{company?.bank_account}</p>
              <p className="text-xs text-gray-600 mt-1">
                A/N {company?.bank_holder}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-4 italic">
              Please include Invoice # in transfer news.
            </p>
          </div>
          <div className="text-center">
            <div className="h-20 mb-2"></div>
            <div className="border-t border-gray-400 w-2/3 mx-auto"></div>
            <p className="text-xs font-bold uppercase mt-1">
              Authorized Signature
            </p>
            <p className="text-xs text-gray-500">{company?.name}</p>
          </div>
        </div>

        <div className="text-center mt-12 text-xs text-gray-400">
          <p>Thank you for your business!</p>
        </div>
      </div>
    </div>
  );
}
