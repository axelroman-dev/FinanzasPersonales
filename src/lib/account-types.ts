export type AccountType = "DEBIT" | "CREDIT" | "SAVINGS" | "VOUCHER";

/** Orden en que se agrupan las cuentas en listas y selectores */
export const ACCOUNT_TYPE_ORDER: AccountType[] = ["DEBIT", "CREDIT", "SAVINGS", "VOUCHER"];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  DEBIT: "Débito",
  CREDIT: "Crédito",
  SAVINGS: "Ahorro",
  VOUCHER: "Vales de despensa",
};

/**
 * Un pago de tarjeta es una transferencia de una cuenta que no es de crédito
 * (débito, ahorro…) a una tarjeta de crédito. Se guarda como TRANSFER: baja
 * el saldo del origen y la deuda de la tarjeta, y no cuenta como gasto (el
 * gasto se contó al comprar).
 */
export function isCardPayment(
  fromType: AccountType | null | undefined,
  toType: AccountType | null | undefined
): boolean {
  return toType === "CREDIT" && !!fromType && fromType !== "CREDIT";
}
