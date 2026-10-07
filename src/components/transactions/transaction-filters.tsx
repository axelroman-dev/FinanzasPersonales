"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxGroup } from "@/components/ui/combobox";
import { CategoryIcon } from "@/components/shared/category-icon";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  type AccountType,
} from "@/lib/account-types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Account = { id: string; name: string; type: AccountType };

type CategoryNode = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  kind: "INCOME" | "EXPENSE" | "INTERNAL";
  parentId: string | null;
  children: CategoryNode[];
};

export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories?: CategoryNode[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  // Las fechas no se controlan (se escriben por partes), así que al limpiar se
  // vuelven a montar para que tomen el valor vacío
  const [dateKey, setDateKey] = useState(0);

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all" && value !== "none") {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.push(`/transactions?${next.toString()}`);
  }

  function clear() {
    setDateKey((k) => k + 1);
    router.push("/transactions");
  }

  const hasFilters =
    params.get("from") ||
    params.get("to") ||
    params.get("type") ||
    params.get("accountId") ||
    params.get("categoryId") ||
    params.get("msi");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
        <Input
          key={`from-${dateKey}`}
          type="date"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value || null)}
          placeholder="Desde"
        />
        <Input
          key={`to-${dateKey}`}
          type="date"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value || null)}
          placeholder="Hasta"
        />
        <Select
          value={params.get("type") ?? "all"}
          onValueChange={(v) => update("type", v === "all" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="INCOME">Ingreso</SelectItem>
            <SelectItem value="EXPENSE">Gasto</SelectItem>
            <SelectItem value="TRANSFER">Transferencia</SelectItem>
          </SelectContent>
        </Select>
        <Combobox
          groups={accountGroups(accounts)}
          value={params.get("accountId") ?? ""}
          onChange={(v) => update("accountId", v || null)}
          placeholder="Todas las cuentas"
          searchPlaceholder="Buscar cuenta…"
          emptyText="Ninguna cuenta coincide"
        />
        {categories && categories.length > 0 && (
          <div className="col-span-2 lg:col-span-1">
            <Combobox
              groups={categoryGroups(categories)}
              value={params.get("categoryId") ?? ""}
              onChange={(v) => update("categoryId", v || null)}
              placeholder="Todas las categorías"
              searchPlaceholder="Buscar categoría…"
              emptyText="Ninguna categoría coincide"
              selected={selectedCategoryLabel(categories, params.get("categoryId"))}
            />
          </div>
        )}
        {hasFilters && (
          <Button variant="outline" onClick={clear} className="col-span-2 lg:col-span-1">
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}

/** Cuentas agrupadas por tipo, con «Todas» al inicio */
function accountGroups(accounts: Account[]): ComboboxGroup[] {
  return [
    { key: "all", options: [{ value: "", label: "Todas las cuentas" }] },
    ...ACCOUNT_TYPE_ORDER.map((type) => ({
      key: type,
      heading: (
        <span className="text-[11px] uppercase tracking-wide">{ACCOUNT_TYPE_LABEL[type]}</span>
      ),
      className: "border-t mt-1 pt-1",
      options: accounts
        .filter((a) => a.type === type)
        .map((a) => ({ value: a.id, label: a.name, keywords: [ACCOUNT_TYPE_LABEL[type]] })),
    })).filter((g) => g.options.length > 0),
  ];
}

/**
 * Categorías agrupadas por principal. Para filtrar, la principal sí se
 * puede elegir: muestra los movimientos de todas sus subcategorías.
 */
function categoryGroups(categories: CategoryNode[]): ComboboxGroup[] {
  return [
    { key: "all", options: [{ value: "", label: "Todas las categorías" }] },
    ...categories.map((cat) => ({
      key: cat.id,
      className: "border-t mt-1 pt-1",
      options: [
        {
          value: cat.id,
          label: cat.name,
          keywords: cat.children.map((c) => c.name),
          className: "font-medium",
          content: (
            <span className="flex items-center gap-2">
              <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
              {cat.name}
              <span className="text-xs font-normal text-muted-foreground">(todas)</span>
            </span>
          ),
        },
        ...cat.children.map((sub) => ({
          value: sub.id,
          label: sub.name,
          keywords: [cat.name],
          className: "pl-10",
          content: (
            <span className="flex items-center gap-2">
              <CategoryIcon icon={sub.icon ?? cat.icon} color={cat.color} size="sm" />
              {sub.name}
            </span>
          ),
        })),
      ],
    })),
  ];
}

/** "Principal › Sub" para la subcategoría elegida; la principal sola si es ella */
function selectedCategoryLabel(categories: CategoryNode[], id: string | null) {
  if (!id) return undefined;
  for (const cat of categories) {
    if (cat.id === id) return `${cat.name} (todas)`;
    const sub = cat.children.find((c) => c.id === id);
    if (sub) return `${cat.name} › ${sub.name}`;
  }
  return undefined;
}
