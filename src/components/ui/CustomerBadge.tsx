
import { Badge } from "./Badge";

type CustomerBadgeProps = {
    name: string;
    customerType: string; // 'UMUM' | 'KHUSUS' | 'CUSTOM' usually, but safe to be string
    className?: string;
};

export function CustomerBadge({ name, customerType, className = "" }: CustomerBadgeProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="font-medium truncate text-gray-900">{name}</span>
            <Badge
                variant={
                    customerType === 'KHUSUS' ? 'success' :
                        customerType === 'CUSTOM' ? 'warning' :
                            'secondary'
                }
                className="h-5 px-1.5 text-[10px] uppercase shrink-0"
            >
                {customerType}
            </Badge>
        </div>
    );
}
