"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Account = { id: string; name: string; type: string };

export function TransactionFilters({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") {
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
    params.get("category") ||
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
        <Select
          defaultValue={params.get("msi") ?? "all"}
          onValueChange={(v) => update("msi", v === "all" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="MSI" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Solo MSI</SelectItem>
            <SelectItem value="false">Sin MSI</SelectItem>
          </SelectContent>
        </Select>
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