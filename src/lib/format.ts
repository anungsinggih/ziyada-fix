type DateInput = string | Date | null | undefined;

export function formatCurrency(amount: number | null | undefined): string {
  const safeAmount = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(safeAmount);
}

export function formatDate(dateInput: DateInput, locale = "id-ID"): string {
  if (!dateInput) return "-";
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString(locale);
}

export function safeDocNo(
  docNo?: string | null,
  fallbackId?: string | null,
  withLabel = false,
): string {
  const trimmed = docNo?.trim();
  if (trimmed) return trimmed;
  if (!fallbackId) return "-";
  const shortId = fallbackId.substring(0, 8);
  return withLabel ? `ID: ${shortId}` : shortId;
}
