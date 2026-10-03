"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 * Selector de cuenta con las cuentas agrupadas por tipo (Débito, Crédito,
 * Ahorro, Vales) y su saldo a la derecha.
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
  const groups = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: accounts.filter((a) => a.type === type && a.id !== excludeId),
  })).filter((g) => g.accounts.length > 0);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group, i) => (
          <SelectGroup key={group.type} className={cn(i > 0 && "border-t mt-1 pt-1")}>
            <SelectLabel className="text-[11px] uppercase tracking-wide">
              {ACCOUNT_TYPE_LABEL[group.type]}
            </SelectLabel>
            {group.accounts.map((a) => (
              <SelectItem
                key={a.id}
                value={a.id}
                aside={
                  <span
                    className={cn(
                      "text-xs tabular-nums text-muted-foreground",
                      a.type === "CREDIT" && a.balance > 0 && "text-red-400"
                    )}
                  >
                    {formatCurrency(a.balance)}
                  </span>
                }
              >
                {a.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
