import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";

export type RelatedDocumentItem = {
  id: string;
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  toneClassName: string;
  iconClassName: string;
  actionLabel?: string;
  onAction?: () => void;
};

type RelatedDocumentsCardProps = {
  title?: string;
  items: RelatedDocumentItem[];
  className?: string;
};

export default function RelatedDocumentsCard({
  title = "Related Documents",
  items,
  className,
}: RelatedDocumentsCardProps) {
  if (items.length === 0) return null;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex justify-between items-center p-3 rounded gap-3 ${item.toneClassName}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 ${item.iconClassName}`}>{item.icon}</div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <div className="text-gray-600">{item.description}</div>
                </div>
              </div>
              {item.onAction && item.actionLabel && (
                <Button size="sm" variant="outline" onClick={item.onAction}>
                  {item.actionLabel}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
