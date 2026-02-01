import React from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, className = "" }: EmptyStateProps) {
  return (
    <div className={`py-12 text-center text-gray-500 ${className}`}>
      <div className="flex items-center justify-center gap-2 text-lg">
        {icon}
        <span>{title}</span>
      </div>
      {description ? <p className="text-sm mt-2">{description}</p> : null}
    </div>
  );
}
