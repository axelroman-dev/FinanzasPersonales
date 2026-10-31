"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogActionGroup,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2, Tag } from "lucide-react";
import { isCardPayment } from "@/lib/account-types";
import { CategorySelect } from "@/components/shared/category-select";
import { CategoryIcon } from "@/components/shared/category-icon";
import { AccountSelect, type AccountOption } from "@/components/shared/account-select";
import { formatCurrency, toDateTimeLocalValue } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-picker";
import { useFormResetKey } from "@/hooks/use-form-reset-key";
import { AttachmentsField, uploadAttachments } from "./attachments-field";
import { DescriptionInput } from "./description-input";
import { useAlert, useConfirm } from "@/components/shared/confirm-dialog";
import type { NewTransactionDefaults } from "@/lib/transaction-defaults";

type CreditAccount = { id: string; name: string; creditLimit: number | null };
/** Tipo en el formulario: el pago de tarjeta se guarda como TRANSFER */
type FormType = "INCOME" | "EXPENSE" | "TRANSFER" | "CARD_PAYMENT";

type CategoryNode = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  kind: "INCOME" | "EXPENSE" | "INTERNAL";
  parentId: string | null;
  children: CategoryNode[];
};

/** Opciones que necesita el formulario (las arma la página de movimientos) */
export type TransactionFormOptions = {
  accounts: AccountOption[];
  creditAccounts: CreditAccount[];
  categories?: CategoryNode[];
  /** Descripciones ya usadas, para sugerirlas al escribir */
  descriptions?: string[];
  /** false si falta ATTACHMENTS_KEY: no se muestra la sección de recibos */
  attachmentsEnabled?: boolean;
  /** Monedas del usuario, para capturar un monto en otra moneda que la cuenta */
  currencies?: string[];
  /** Cuánto vale 1 de cada moneda en la principal (vista previa de la conversión) */
  rates?: Record<string, number>;
};

/** Datos de un movimiento existente para editarlo */
export type EditableTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  description: string;
  categoryId: string | null;
  accountId: string;
  transferAccountId: string | null;
  isMsi: boolean;
  msiInstallments: number | null;
  /** Capturado en otra moneda: el monto y la moneda originales */
  original?: { amount: number; currency: string; rate: number | null } | null;
};

export function TransactionActions({
  mode,
  accounts,
  creditAccounts,
  categories,
  attachmentsEnabled,
  descriptions,
  currencies,
  rates,
  transaction,
  defaults,
  children,
}: {
  mode: "create" | "edit";
  accounts: AccountOption[];
  creditAccounts: CreditAccount[];
  categories?: CategoryNode[];
  attachmentsEnabled?: boolean;
  descriptions?: string[];
  currencies?: string[];
  rates?: Record<string, number>;
  transaction?: EditableTransaction;
  /** Solo al crear: valores iniciales (p. ej. los filtros de la lista) */
  defaults?: NewTransactionDefaults;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formKey = useFormResetKey(open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <TxFormDialog
        key={formKey}
        mode={mode}
        accounts={accounts}
        creditAccounts={creditAccounts}
        categories={categories}
        attachmentsEnabled={attachmentsEnabled}
        descriptions={descriptions}
        currencies={currencies}
        rates={rates}
        transaction={transaction}
        defaults={defaults}
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </Dialog>
  );
}

function TxFormDialog({
  mode,
  accounts,
  creditAccounts,
  categories,
  attachmentsEnabled,
  descriptions,
  currencies = [],
  rates = {},
  transaction,
  defaults,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  accounts: AccountOption[];
  creditAccounts: CreditAccount[];
  categories?: CategoryNode[];
  attachmentsEnabled?: boolean;
  descriptions?: string[];
  currencies?: string[];
  rates?: Record<string, number>;
  transaction?: EditableTransaction;
  defaults?: NewTransactionDefaults;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Archivos elegidos que se suben al guardar
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const typeOf = (id: string | null | undefined) => accounts.find((a) => a.id === id)?.type;
  const [type, setType] = useState<FormType>(() => {
    if (!transaction) return defaults?.type ?? "EXPENSE";
    // Una transferencia a una tarjeta se edita como pago de tarjeta
    return transaction.type === "TRANSFER" &&
      isCardPayment(typeOf(transaction.accountId), typeOf(transaction.transferAccountId))
      ? "CARD_PAYMENT"
      : transaction.type;
  });
  const isTransferLike = type === "TRANSFER" || type === "CARD_PAYMENT";
  // Un pago de tarjeta ya guardado solo deja cambiar el monto y la fecha
  const lockedCardPayment = mode === "edit" && type === "CARD_PAYMENT";
  // En un pago de tarjeta: se paga desde una cuenta que no es de crédito, a una tarjeta
  const payFromAccounts = accounts.filter((a) => a.type !== "CREDIT");
  const cardAccounts = accounts.filter((a) => a.type === "CREDIT");
  const [amount, setAmount] = useState<number | "">(
    transaction
      ? Math.abs(Number(transaction.original?.amount ?? transaction.amount))
      : ""
  );
  // Fecha y hora en la zona del navegador ("YYYY-MM-DDTHH:mm")
  const [date, setDate] = useState(
    toDateTimeLocalValue(transaction?.date ?? new Date())
  );
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(
    transaction?.categoryId ?? defaults?.categoryId ?? ""
  );
  // Sin cuenta preseleccionada: con varias hay que elegirla (salvo que venga
  // del filtro); con una sola no hay nada que elegir
  // En un pago de tarjeta, una tarjeta del filtro es el destino, no el origen
  const defaultIsCard = type === "CARD_PAYMENT" && typeOf(defaults?.accountId) === "CREDIT";
  const originChoices = type === "CARD_PAYMENT" ? payFromAccounts : accounts;
  const [accountId, setAccountId] = useState(
    transaction?.accountId ??
      (defaultIsCard ? undefined : defaults?.accountId) ??
      (originChoices.length === 1 ? originChoices[0].id : "")
  );
  const [transferAccountId, setTransferAccountId] = useState(
    transaction?.transferAccountId ?? (defaultIsCard ? defaults!.accountId! : "")
  );
  // Solo se transfiere entre cuentas de la misma moneda
  const sourceCurrency = accounts.find((a) => a.id === accountId)?.currency;
  // Moneda del monto: la de la cuenta, salvo que se elija otra (p. ej. una
  // compra de 20 USD con tarjeta en pesos: se guarda convertida)
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(
    transaction?.original?.currency ?? null
  );
  const sameCurrency = (list: AccountOption[]) =>
    sourceCurrency ? list.filter((a) => a.currency === sourceCurrency) : list;

  // MSI
  const [isMsi, setIsMsi] = useState(transaction?.isMsi ?? defaults?.isMsi ?? false);
  const [msiInstallments, setMsiInstallments] = useState<number | "">(
    transaction?.msiInstallments ?? 3
  );

  // Solo permitir MSI si es gasto en crédito
  const canMsi = type === "EXPENSE" && creditAccounts.some((c) => c.id === accountId);
  // Otra moneda solo en gastos e ingresos (no transferencias ni MSI)
  const canForeign =
    !isTransferLike && !(mode === "create" && isMsi && canMsi) && !!sourceCurrency;
  const amountCurrency = (canForeign && currencyChoice) || sourceCurrency;
  const currencyOptions = sourceCurrency
    ? [...new Set([sourceCurrency, ...currencies])]
    : currencies;
  // Al editar uno ya convertido, sin cambiar moneda ni cuenta, el servidor
  // conserva la tasa con que se guardó
  const savedRate =
    transaction?.original?.currency === amountCurrency &&
    transaction?.accountId === accountId
      ? transaction?.original?.rate ?? null
      : null;
  // 1 de la moneda del monto = N de la cuenta
  const previewRate =
    amountCurrency && sourceCurrency && amountCurrency !== sourceCurrency
      ? savedRate ??
        (rates[amountCurrency] && rates[sourceCurrency]
          ? rates[amountCurrency] / rates[sourceCurrency]
          : null)
      : undefined;
  // Lo cobrado en la moneda de la cuenta. null = lo calcula la tasa; si el
  // banco cobró otra cosa se escribe a mano y se guarda tal cual
  const [chargedManual, setChargedManual] = useState<number | "" | null>(null);
  const chargedAuto =
    previewRate && amount !== ""
      ? Math.round(Number(amount) * previewRate * 100) / 100
      : "";
  const charged = chargedManual ?? chargedAuto;

  // Las categorías dependen del tipo: al cambiarlo, la elegida ya no aplica
  function onTypeChange(next: FormType) {
    if (next !== type) setCategoryId("");
    if (next === "CARD_PAYMENT") {
      // Quitar lo que no aplica: origen de crédito o destino que no es tarjeta
      if (typeOf(accountId) === "CREDIT") {
        setAccountId(payFromAccounts.length === 1 ? payFromAccounts[0].id : "");
      }
      if (typeOf(transferAccountId) !== "CREDIT") {
        setTransferAccountId(cardAccounts.length === 1 ? cardAccounts[0].id : "");
      }
    }
    setType(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!accountId) {
      setError(
        type === "CARD_PAYMENT"
          ? "Selecciona la cuenta desde la que pagas"
          : type === "TRANSFER"
            ? "Selecciona la cuenta origen"
            : "Selecciona la cuenta"
      );
      return;
    }
    if (isTransferLike && !transferAccountId) {
      setError(type === "CARD_PAYMENT" ? "Selecciona la tarjeta a pagar" : "Selecciona la cuenta destino");
      return;
    }
    if (isTransferLike && transferAccountId === accountId) {
      setError("Las cuentas deben ser distintas");
      return;
    }

    startTransition(async () => {
      try {
        const body: any = {
          type: isTransferLike ? "TRANSFER" : type,
          amount: Number(amount),
          // Instante exacto (con zona): el servidor no sabe la hora local
          date: new Date(date).toISOString(),
          description,
          categoryId: isTransferLike ? null : (categoryId || null),
          accountId,
          transferAccountId: isTransferLike ? transferAccountId : null,
          ...(amountCurrency && { currency: amountCurrency }),
          ...(previewRate !== undefined &&
            chargedManual && { accountAmount: Number(chargedManual) }),
        };

        if (mode === "create" && isMsi && canMsi) {
          body.isMsi = true;
          body.msiInstallments = Number(msiInstallments);
        }

        const url =
          mode === "create"
            ? "/api/transactions"
            : `/api/transactions/${transaction!.id}`;
        const method = mode === "create" ? "POST" : "PATCH";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al guardar");
          return;
        }

        // Los adjuntos necesitan el id: se suben después de guardar. En una
        // compra a MSI van en la compra (parent), no en las mensualidades
        const savedId: string = data.parent?.id ?? data.id;
        const uploadError = await uploadAttachments(savedId, pendingFiles);
        onSaved();
        router.refresh();
        if (uploadError) {
          showAlert({
            title: "Los recibos no se subieron",
            description: `El movimiento se guardó, pero los recibos no: ${uploadError}`,
          });
        }
      } catch {
        setError("Error al guardar");
      }
    });
  }

  async function onDelete() {
    if (!transaction) return;
    const ok = await confirm({
      title: "¿Eliminar este movimiento?",
      description: `"${transaction.description}" se eliminará. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSaved();
        router.refresh();
      }
    });
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Nuevo movimiento" : "Editar movimiento"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={type}
            onValueChange={(v) => onTypeChange(v as any)}
            disabled={lockedCardPayment}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Gasto</SelectItem>
              <SelectItem value="INCOME">Ingreso</SelectItem>
              <SelectItem value="TRANSFER">Transferencia</SelectItem>
              {/* Sin tarjetas no hay nada que pagar */}
              {cardAccounts.length > 0 && payFromAccounts.length > 0 && (
                <SelectItem value="CARD_PAYMENT">Pago de tarjeta</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                required
              />
              {canForeign && currencyOptions.length > 1 && (
                <Select value={amountCurrency} onValueChange={setCurrencyChoice}>
                  <SelectTrigger className="w-24 shrink-0" aria-label="Moneda del monto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Fecha y hora</Label>
            <DateTimePicker id="date" value={date} onChange={setDate} />
          </div>
        </div>
        {previewRate !== undefined && (
          <div className="-mt-2 space-y-2">
            {previewRate === null && chargedManual === null ? (
              <p className="text-xs text-muted-foreground">
                <span className="text-amber-400">
                  Sin tipo de cambio {amountCurrency}→{sourceCurrency}: revisa tu proveedor en Mi
                  perfil
                </span>{" "}
                o{" "}
                <button
                  type="button"
                  onClick={() => setChargedManual("")}
                  className="text-primary hover:underline"
                >
                  escribe cuánto se cobró
                </button>
              </p>
            ) : (
              <>
                <Label htmlFor="charged">Se cobró en {sourceCurrency}</Label>
                <Input
                  id="charged"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={charged}
                  onChange={(e) =>
                    setChargedManual(e.target.value === "" ? "" : parseFloat(e.target.value))
                  }
                  required={chargedManual !== null}
                />
                <p className="text-xs text-muted-foreground">
                  {chargedManual !== null ? (
                    <>
                      {chargedManual && amount
                        ? `1 ${amountCurrency} = ${(Number(chargedManual) / Number(amount)).toFixed(4)} ${sourceCurrency}, según lo que escribiste`
                        : "Escribe lo que aparece en tu estado de cuenta"}
                      {previewRate && (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => setChargedManual(null)}
                            className="text-primary hover:underline"
                          >
                            Usar el tipo de cambio
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      1 {amountCurrency} = {previewRate!.toFixed(4)} {sourceCurrency}
                      {savedRate ? ", la tasa con que se guardó" : ", tipo de cambio de hoy"}. Si
                      tu banco cobró otra cantidad, corrígela aquí
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <DescriptionInput
            id="description"
            value={description}
            onChange={setDescription}
            known={descriptions ?? []}
            placeholder="Ej. Comida, salario, etc."
            required
            disabled={lockedCardPayment}
          />
        </div>

        <div className="space-y-2">
          <Label>
            {type === "CARD_PAYMENT"
              ? "Pagar desde"
              : type === "TRANSFER"
                ? "Cuenta origen"
                : "Cuenta"}
          </Label>
          <AccountSelect
            accounts={type === "CARD_PAYMENT" ? payFromAccounts : accounts}
            value={accountId}
            onChange={(id) => {
              setAccountId(id);
              const to = accounts.find((a) => a.id === transferAccountId);
              const from = accounts.find((a) => a.id === id);
              if (id === transferAccountId || (to && from && to.currency !== from.currency)) {
                setTransferAccountId("");
              }
            }}
            disabled={lockedCardPayment}
          />
        </div>

        {type === "TRANSFER" && (
          <div className="space-y-2">
            <Label>Cuenta destino</Label>
            <AccountSelect
              accounts={sameCurrency(accounts)}
              value={transferAccountId}
              onChange={setTransferAccountId}
              placeholder="Selecciona cuenta destino"
              excludeId={accountId}
            />
          </div>
        )}

        {type === "CARD_PAYMENT" && (
          <div className="space-y-2">
            <Label>Tarjeta a pagar</Label>
            <AccountSelect
              accounts={sameCurrency(cardAccounts)}
              value={transferAccountId}
              onChange={setTransferAccountId}
              placeholder="Selecciona la tarjeta"
              disabled={lockedCardPayment}
            />
            {/* Al editar, la deuda ya incluye este pago: no tiene caso */}
            {!lockedCardPayment && (
              <CardDebtHint
                debt={cardAccounts.find((a) => a.id === transferAccountId)?.balance}
                currency={cardAccounts.find((a) => a.id === transferAccountId)?.currency}
                onPayAll={setAmount}
              />
            )}
          </div>
        )}

        {mode === "create" && canMsi && (
          <div className="rounded-md border border-dashed p-3 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isMsi"
                checked={isMsi}
                onCheckedChange={(c) => setIsMsi(!!c)}
              />
              <Label htmlFor="isMsi" className="text-sm cursor-pointer">
                Compra a Meses Sin Intereses (MSI)
              </Label>
            </div>
            {isMsi && (
              <div className="space-y-2">
                <Label htmlFor="msiInstallments">Número de mensualidades</Label>
                <Input
                  id="msiInstallments"
                  type="number"
                  min={2}
                  max={48}
                  value={msiInstallments}
                  onChange={(e) =>
                    setMsiInstallments(
                      e.target.value === "" ? "" : parseInt(e.target.value)
                    )
                  }
                />
                {amount && msiInstallments && Number(msiInstallments) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Se crearán {msiInstallments} mensualidades de $
                    {(Number(amount) / Number(msiInstallments)).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {type === "CARD_PAYMENT" ? (
          // La categoría la pone el sistema
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
            <CategoryIcon icon="credit-card" color="#60a5fa" size="sm" />
            <span>
              Categoría: <span className="font-medium">Pago de tarjeta</span>
            </span>
            <span className="ml-auto text-xs text-muted-foreground">automática</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Categoría (opcional)
            </Label>
            <CategorySelect
              categories={categories ?? []}
              kind={type === "INCOME" ? "INCOME" : "EXPENSE"}
              value={categoryId}
              onChange={setCategoryId}
              disabled={isTransferLike}
            />
          </div>
        )}

        {lockedCardPayment && (
          <p className="text-xs text-muted-foreground">
            En un pago de tarjeta solo puedes cambiar el monto y la fecha. Para usar otras
            cuentas, elimínalo y regístralo de nuevo.
          </p>
        )}

        {attachmentsEnabled && (
          <AttachmentsField
            transactionId={transaction?.id}
            pending={pendingFiles}
            onPendingChange={setPendingFiles}
          />
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogActions className="justify-between">
          {mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          )}
          <DialogActionGroup>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </DialogActionGroup>
        </DialogActions>
      </form>
    </DialogContent>
  );
}

/** Deuda de la tarjeta elegida y un atajo para pagarla completa */
function CardDebtHint({
  debt,
  currency,
  onPayAll,
}: {
  debt: number | undefined;
  currency: string | undefined;
  onPayAll: (amount: number) => void;
}) {
  if (debt === undefined) return null;
  if (debt <= 0) {
    return <p className="text-xs text-muted-foreground">Esta tarjeta no tiene deuda</p>;
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      Deuda actual: <span className="tabular-nums text-red-400">{formatCurrency(debt, currency)}</span>
      <button
        type="button"
        onClick={() => onPayAll(debt)}
        className="text-primary hover:underline"
      >
        Pagar todo
      </button>
    </p>
  );
}
