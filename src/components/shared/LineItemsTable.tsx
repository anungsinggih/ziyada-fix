import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/Table";

type LineItemsTableColumn<Row> = {
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: Row) => React.ReactNode;
};

type LineItemsTableProps<Row> = {
  title?: string;
  rows: Row[];
  columns: LineItemsTableColumn<Row>[];
  totalLabel?: string;
  totalValue?: React.ReactNode;
  emptyLabel?: string;
  className?: string;
};

export default function LineItemsTable<Row>({
  title = "Line Items",
  rows,
  columns,
  totalLabel = "TOTAL:",
  totalValue,
  emptyLabel = "No items",
  className,
}: LineItemsTableProps<Row>) {
  const totalColSpan = Math.max(columns.length - 1, 1);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.label} className={col.headerClassName}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-sm text-gray-500">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((col) => (
                    <TableCell key={col.label} className={col.cellClassName}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {totalValue !== undefined && (
              <TableRow className="bg-gray-50 font-bold border-t-2">
                <TableCell colSpan={totalColSpan} className="text-right">
                  {totalLabel}
                </TableCell>
                <TableCell className="text-right">{totalValue}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
