"use client";

import { Combobox } from "@/components/ui/combobox";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  type AccountType,
} from "@/lib/account-types";

export type AccountOption = {
  id: string;
  name: string;
  type: AccountType;
  /** Saldo actual; en crédito es la deuda usada */
  balance: number;
};

/**
 * Selector de cuenta con búsqueda: las cuentas van agrupadas por tipo
 * (Débito, Crédito, Ahorro, Vales) con su saldo a la derecha, y se puede
 * escribir para filtrarlas por nombre o tipo.
 */
export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Selecciona cuenta",
  excludeId,
}: {
  accounts: AccountOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Cuenta que no se puede elegir (p. ej. el origen de una transferencia) */
  excludeId?: string;
}) {
  const groups = ACCOUNT_TYPE_ORDER.map((type, i) => ({
    key: type,
    heading: (
      <span className="text-[11px] uppercase tracking-wide">{ACCOUNT_TYPE_LABEL[type]}</span>
    ),
    className: cn(i > 0 && "border-t mt-1 pt-1"),
    options: accounts
      .filter((a) => a.type === type && a.id !== excludeId)
      .map((a) => ({
        value: a.id,
        label: a.name,
        keywords: [ACCOUNT_TYPE_LABEL[type]],
        aside: (
          <span
            className={cn(
              "text-xs tabular-nums text-muted-foreground",
              a.type === "CREDIT" && a.balance > 0 && "text-red-400"
            )}
          >
            {formatCurrency(a.balance)}
          </span>
        ),
      })),
  })).filter((g) => g.options.length > 0);

  return (
    <Combobox
      groups={groups}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar cuenta…"
      emptyText="Ninguna cuenta coincide"
    />
  );
}
