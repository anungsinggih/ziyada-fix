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
import { SalesInvoicePrint } from "./print/SalesInvoicePrint";

type SalesDetail = {
  id: string;
  sales_date: string;
  sales_no: string | null;
  customer_id: string;
  customer_name: string;
  terms: "CASH" | "CREDIT";
  payment_method_code?: string | null;
  total_amount: number;
  shipping_fee?: number | null;
  discount_amount?: number | null;
  status: "DRAFT" | "POSTED" | "VOID";
  notes: string | null;
  created_at: string;
};

type SalesItem = {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  size_name?: string;
  color_name?: string;
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

type CompanyBank = {
  id: string;
  code: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
  is_default: boolean;
};

export default function SalesDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<SalesDetail | null>(null);
  const [items, setItems] = useState<SalesItem[]>([]);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc>({});
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [companyBanks, setCompanyBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSaleDetail(id);
      fetchCompanyProfile();
      fetchCompanyBanks();
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
                    shipping_fee,
                    discount_amount,
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

      // payment method label not needed in print layout

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
                        sku,
                        sizes ( name ),
                        colors ( name )
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
          size_name:
            (item.items as unknown as { sizes?: { name: string } })?.sizes?.name ||
            undefined,
          color_name:
            (item.items as unknown as { colors?: { name: string } })?.colors?.name ||
            undefined,
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

  async function fetchCompanyBanks() {
    const { data } = await supabase
      .from("company_banks")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("bank_name", { ascending: true });
    if (data) setCompanyBanks(data);
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

  async function handlePostDraft() {
    if (!sale) return;
    if (
      !confirm(
        "Are you sure you want to POST this sales? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsPosting(true);
    setPostError(null);
    setPostSuccess(null);

    try {
      const { error: rpcError } = await supabase.rpc("rpc_post_sales", {
        p_sales_id: sale.id,
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

      setPostSuccess("Sales posted successfully!");
      fetchSaleDetail(sale.id);
    } catch (err: unknown) {
      if (err instanceof Error) setPostError(err.message || "Failed to post sales");
    } finally {
      setIsPosting(false);
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
              onClick={handlePostDraft}
              isLoading={isPosting}
              disabled={isPosting}
              className="bg-green-600 hover:bg-green-700 text-white"
              icon={<Icons.Check className="w-4 h-4" />}
            >
              Post
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
        {(postError || postSuccess) && (
          <div className="w-full">
            {postError && (
              <Alert variant="error" title="Gagal" description={postError} />
            )}
            {postSuccess && (
              <Alert
                variant="success"
                title="Berhasil"
                description={postSuccess}
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
                  <TableCell>
                    <div>{item.item_name}</div>
                    {(item.size_name || item.color_name) && (
                      <div className="text-xs text-gray-500">
                        {[item.size_name, item.color_name].filter(Boolean).join(" • ")}
                      </div>
                    )}
                  </TableCell>
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
              {(sale.shipping_fee || 0) > 0 && (
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={5} className="text-right">
                    Ongkir
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(sale.shipping_fee || 0)}
                  </TableCell>
                </TableRow>
              )}
              {(sale.discount_amount || 0) > 0 && (
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={5} className="text-right">
                    Diskon
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    -{formatCurrency(sale.discount_amount || 0)}
                  </TableCell>
                </TableRow>
              )}
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
        <div className="print:hidden">
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
        </div>
      )}

      {/* --- PRINT ONLY SECTION --- */}
      {sale && (
        <SalesInvoicePrint
          data={{
            id: sale.id,
            sales_no: sale.sales_no,
            sales_date: sale.sales_date,
            customer_name: sale.customer_name,
            terms: sale.terms,
            total_amount: sale.total_amount,
            shipping_fee: sale.shipping_fee,
            discount_amount: sale.discount_amount,
            notes: sale.notes
          }}
          items={items}
          company={company}
          banks={companyBanks}
        />
      )}
    </div>
  );
}
