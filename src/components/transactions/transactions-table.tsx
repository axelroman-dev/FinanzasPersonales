"use client";

import {
  Card,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight } from "lucide-react";

type Tx = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  description: string;
  category: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  /** Movimiento con categoría interna (balance inicial o ajuste de cuenta) */
  isAdjustment: boolean;
  accountName: string;
  transferAccountName: string | null;
  isMsi: boolean;
  msiParentId: string | null;
  msiInstallments: number | null;
  subscriptionName: string | null;
};

export function TransactionsTable({ transactions }: { transactions: Tx[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Cuenta</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const Icon =
                tx.type === "INCOME"
                  ? ArrowUpRight
                  : tx.type === "EXPENSE"
                  ? ArrowDownRight
                  : ArrowLeftRight;
              const color =
                tx.type === "INCOME"
                  ? "text-emerald-400"
                  : tx.type === "EXPENSE"
                  ? "text-red-400"
                  : "text-blue-400";
              const sign =
                tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "−" : "";

              return (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatShortDate(new Date(tx.date))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {tx.categoryName && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                              style={{
                                backgroundColor: tx.categoryColor
                                  ? `${tx.categoryColor}20`
                                  : undefined,
                                color: tx.categoryColor ?? undefined,
                                borderColor: tx.categoryColor
                                  ? `${tx.categoryColor}50`
                                  : undefined,
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: tx.categoryColor ?? "#71717a" }}
                              />
                              {tx.categoryName}
                            </span>
                          )}
                          {tx.category && !tx.categoryName && (
                            <Badge variant="secondary" className="text-xs">
                              {tx.category}
                            </Badge>
                          )}
                          {tx.isMsi && !tx.msiParentId && (
                            <Badge variant="warning" className="text-xs">
                              MSI {tx.msiInstallments}x
                            </Badge>
                          )}
                          {tx.isMsi && tx.msiParentId && (
                            <Badge variant="outline" className="text-xs">
                              MSI {tx.msiInstallments}x
                            </Badge>
                          )}
                          {tx.subscriptionName && (
                            <Badge variant="secondary" className="text-xs">
                              {tx.subscriptionName}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {tx.accountName}
                    {tx.transferAccountName && (
                      <span className="text-xs"> → {tx.transferAccountName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {tx.isAdjustment
                      ? "Ajuste"
                      : tx.type === "INCOME"
                      ? "Ingreso"
                      : tx.type === "EXPENSE"
                      ? "Gasto"
                      : "Transferencia"}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm font-semibold text-right tabular-nums ${color}`}
                  >
                    {sign}
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}