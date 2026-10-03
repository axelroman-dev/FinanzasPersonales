export type AccountType = "DEBIT" | "CREDIT" | "SAVINGS" | "VOUCHER";

/** Orden en que se agrupan las cuentas en listas y selectores */
export const ACCOUNT_TYPE_ORDER: AccountType[] = ["DEBIT", "CREDIT", "SAVINGS", "VOUCHER"];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  DEBIT: "Débito",
  CREDIT: "Crédito",
  SAVINGS: "Ahorro",
  VOUCHER: "Vales de despensa",
};
