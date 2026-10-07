/**
 * Fechas de cobro de una suscripción (en la zona horaria del servidor, TZ).
 * Un cobro cae en el día de cobro a mediodía; si el mes no tiene ese día
 * (31 en febrero), cae en su último día.
 */
export type SubscriptionSchedule = {
  frequency: "MONTHLY" | "YEARLY";
  billingDay: number;
  /** 1-12, solo en las anuales */
  billingMonth: number | null;
};

/** Cobro del mes `month` (0-11) de `year`, con el día ajustado al mes */
function dueIn(year: number, month: number, billingDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(billingDay, lastDay), 12);
}

/** Mes (0-11) de cobro de una anual; si falta, enero */
function yearlyMonth(s: SubscriptionSchedule): number {
  return (s.billingMonth ?? 1) - 1;
}

/** Primer cobro en el día de `from` o después (ese mismo día cuenta) */
export function firstDueOnOrAfter(s: SubscriptionSchedule, from: Date): Date {
  const startOfDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (s.frequency === "YEARLY") {
    const thisYear = dueIn(from.getFullYear(), yearlyMonth(s), s.billingDay);
    return thisYear >= startOfDay
      ? thisYear
      : dueIn(from.getFullYear() + 1, yearlyMonth(s), s.billingDay);
  }
  const thisMonth = dueIn(from.getFullYear(), from.getMonth(), s.billingDay);
  return thisMonth >= startOfDay
    ? thisMonth
    : dueIn(from.getFullYear(), from.getMonth() + 1, s.billingDay);
}

/** El cobro siguiente a `due` */
export function nextDueAfter(s: SubscriptionSchedule, due: Date): Date {
  if (s.frequency === "YEARLY") {
    return dueIn(due.getFullYear() + 1, yearlyMonth(s), s.billingDay);
  }
  return dueIn(due.getFullYear(), due.getMonth() + 1, s.billingDay);
}

/** ¿Le toca cobrarse en el mes de `now`? (las anuales, solo en su mes) */
export function isDueInMonth(s: SubscriptionSchedule, now: Date): boolean {
  return s.frequency === "MONTHLY" || yearlyMonth(s) === now.getMonth();
}

/** Lo que cuesta al mes: las anuales, repartidas en 12 */
export function monthlyEquivalent(s: SubscriptionSchedule & { amount: number }): number {
  return s.frequency === "YEARLY" ? s.amount / 12 : s.amount;
}
