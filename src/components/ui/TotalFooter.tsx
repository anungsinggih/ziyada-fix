import { formatCurrency } from "../../lib/format";

type TotalFooterProps = {
  label?: string;
  amount: number;
  className?: string;
  labelClassName?: string;
  amountClassName?: string;
};

export function TotalFooter({
  label = "Total",
  amount,
  className = "",
  labelClassName = "",
  amountClassName = "",
}: TotalFooterProps) {
  return (
    <div
      className={`bg-gray-50 p-4 flex justify-between items-center border-t border-gray-200 ${className}`}
    >
      <span className={`font-bold text-gray-600 uppercase text-xs tracking-wider ${labelClassName}`}>
        {label}
      </span>
      <span className={`font-bold text-2xl ${amountClassName}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}
