import { Prisma } from "@prisma/client";

/**
 * Divide el total de una compra MSI en mensualidades de centavos exactos.
 * Los centavos que sobran se reparten en las primeras mensualidades, así que
 * la suma siempre es igual al total (100 / 3 → 33.34, 33.33, 33.33).
 */
export function splitInstallments(
  total: Prisma.Decimal | number | string,
  installments: number
): Prisma.Decimal[] {
  const cents = new Prisma.Decimal(total).mul(100).toDecimalPlaces(0);
  const base = cents.divToInt(installments);
  const remainder = cents.sub(base.mul(installments)).toNumber();
  return Array.from({ length: installments }, (_, i) =>
    base.add(i < remainder ? 1 : 0).div(100)
  );
}

/**
 * Cuánta deuda quitar de la tarjeta al borrar una compra MSI completa.
 *
 * Borrar una mensualidad suelta ya reduce la deuda por su monto, así que si
 * falta alguna solo se quita lo que suman las que quedan. Si están todas, se
 * quita el total de la compra.
 */
export function msiParentRevertAmount(params: {
  totalAmount: Prisma.Decimal | number | string;
  installments: number;
  remainingChildren: (Prisma.Decimal | number | string)[];
}): Prisma.Decimal {
  if (params.remainingChildren.length >= params.installments) {
    return new Prisma.Decimal(params.totalAmount);
  }
  return params.remainingChildren.reduce<Prisma.Decimal>(
    (sum, amount) => sum.add(amount),
    new Prisma.Decimal(0)
  );
}
