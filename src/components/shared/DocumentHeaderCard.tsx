import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { StatusBadge } from "../ui/StatusBadge";

type DocumentHeaderField = {
  label: string;
  value: React.ReactNode;
};

type DocumentHeaderCardProps = {
  title: string;
  docNo: string;
  status: string;
  fields: DocumentHeaderField[];
  notes?: string | null;
  className?: string;
  hideStatusOnPrint?: boolean;
};

export default function DocumentHeaderCard({
  title,
  docNo,
  status,
  fields,
  notes,
  className,
  hideStatusOnPrint,
}: DocumentHeaderCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="bg-gray-50">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">{docNo}</p>
          </div>
          <StatusBadge
            status={status}
            className={hideStatusOnPrint ? "print:hidden" : ""}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-gray-600">{field.label}</p>
              <div className="font-medium">{field.value}</div>
            </div>
          ))}
        </div>
        {notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-600 text-sm">Notes</p>
            <p className="text-sm mt-1">{notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
