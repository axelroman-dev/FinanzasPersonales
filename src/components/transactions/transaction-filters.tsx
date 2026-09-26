"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Account = { id: string; name: string; type: string };

type CategoryNode = {
  id: string;
  name: string;
  color: string | null;
  kind: "INCOME" | "EXPENSE" | "BOTH" | "INTERNAL";
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
      <div className="grid gap-2 md:grid-cols-6">
        <Input
          type="date"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value || null)}
          placeholder="Desde"
        />
        <Input
          type="date"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value || null)}
          placeholder="Hasta"
        />
        <Select
          defaultValue={params.get("type") ?? "all"}
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
        <Select
          defaultValue={params.get("accountId") ?? "all"}
          onValueChange={(v) => update("accountId", v === "all" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Cuenta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories && categories.length > 0 && (
          <Select
            defaultValue={params.get("categoryId") ?? "all"}
            onValueChange={(v) => update("categoryId", v === "all" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((cat) => (
                <SelectGroup key={cat.id}>
                  <SelectLabel className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cat.color ?? "#71717a" }}
                    />
                    {cat.name}
                  </SelectLabel>
                  <SelectItem value={cat.id} className="pl-4">
                    (Todas)
                  </SelectItem>
                  {cat.children.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id} className="pl-8">
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasFilters && (
          <Button variant="outline" onClick={clear}>
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}