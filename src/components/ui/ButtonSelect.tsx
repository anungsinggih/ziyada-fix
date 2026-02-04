import { Button } from "./Button";

type ButtonSelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type ButtonSelectProps = {
  label?: string;
  value: string;
  options: ButtonSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
};

export function ButtonSelect({
  label,
  value,
  options,
  onChange,
  className = "",
  buttonClassName = "",
}: ButtonSelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 mb-3 w-full ${className}`}>
      {label && (
        <label className="text-sm font-medium text-[var(--text-main)]">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <Button
              key={opt.value}
              type="button"
              size="md"
              variant={isActive ? "primary" : "outline"}
              onClick={() => onChange(opt.value)}
              disabled={opt.disabled}
              className={`h-10 ${buttonClassName}`}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
