import { prisma } from "@/lib/db";
import { convertAmount, getConverter, type Converter } from "@/lib/exchange-rates";
import { monthRange } from "@/lib/subscriptions";
import { firstDueOnOrAfter, nextDueAfter } from "@/lib/subscription-schedule";
import { applyBalanceDeltas, balanceEffects } from "@/lib/transaction-balance";

/** Tope de cobros atrasados por suscripción en una pasada (3 años mensuales) */
const MAX_CATCH_UP = 36;

/**
 * Registra los cobros de suscripciones que ya tocan: por cada uno crea el
 * gasto en la cuenta y la categoría de la suscripción y ajusta el saldo.
 *
 * `nextChargeAt` es el próximo cobro por registrar y avanza al registrarlo,
 * así que cada fecha se cobra una sola vez: borrar el movimiento no lo vuelve
 * a crear. Si ya hay un movimiento ligado a la suscripción en ese mes (pagado
 * a mano), solo avanza sin cobrar. Si `nextChargeAt` está vacío (suscripción
 * nueva, reactivada o recién migrada), arranca desde hoy sin cobrar fechas
 * pasadas.
 *
 * Una suscripción en otra moneda que la de su cuenta se convierte con el tipo
 * de cambio del proveedor del usuario al momento de registrar el cobro. Sin
 * tipo de cambio no se cobra: se reintenta en la siguiente pasada.
 *
 * Es idempotente y segura en paralelo: cada avance se hace con un update
 * condicionado al valor anterior, y quien pierde la carrera se detiene.
 *
 * @param userId solo las de ese usuario; sin él, las de todos
 * @returns cuántos cobros se registraron
 */
export async function chargeDueSubscriptions(
  userId?: string,
  now: Date = new Date()
): Promise<number> {
  const subs = await prisma.subscription.findMany({
    where: { isActive: true, ...(userId && { userId }) },
    include: {
      account: { select: { type: true, currency: true } },
      user: {
        select: {
          primaryCurrency: true,
          secondaryCurrencies: true,
          ratesProvider: true,
          ratesProviderUrl: true,
          manualRates: true,
          manualRatesAt: true,
        },
      },
    },
  });

  // Un convertidor por usuario, solo si alguna suscripción lo necesita
  const converters = new Map<string, Promise<Converter>>();
  const converterFor = (sub: (typeof subs)[number]) => {
    let c = converters.get(sub.userId);
    if (!c) {
      c = getConverter(sub.userId, sub.user, [sub.currency, sub.account.currency]);
      converters.set(sub.userId, c);
    }
    return c;
  };

  let charged = 0;
  for (const sub of subs) {
    let current = sub.nextChargeAt;
    let due = current ?? firstDueOnOrAfter(sub, now);

    // Sin fecha guardada: fijarla aunque todavía no toque
    if (!current && due > now) {
      await prisma.subscription.updateMany({
        where: { id: sub.id, nextChargeAt: null },
        data: { nextChargeAt: due },
      });
      continue;
    }

    // Sin tipo de cambio, la siguiente pasada lo vuelve a intentar
    let charge: ReturnType<typeof convertAmount> = null;
    if (due <= now) {
      const converter =
        sub.currency !== sub.account.currency ? await converterFor(sub) : null;
      charge = convertAmount(sub.amount, sub.currency, sub.account.currency, (f, t) =>
        converter ? converter.rate(f, t) : null
      );
      if (!charge) {
        console.error(
          `Suscripción ${sub.id}: sin tipo de cambio ${sub.currency}→${sub.account.currency}, no se cobró`
        );
        continue;
      }
    }
    const converted = sub.currency !== sub.account.currency;

    for (let i = 0; i < MAX_CATCH_UP && due <= now && charge; i++) {
      const amount = charge.amount;
      const next = nextDueAfter(sub, due);
      const didCharge = await prisma.$transaction(async (tx) => {
        const claimed = await tx.subscription.updateMany({
          where: { id: sub.id, nextChargeAt: current },
          data: { nextChargeAt: next },
        });
        // Otro proceso ya registró este cobro
        if (claimed.count === 0) return null;

        const { start, end } = monthRange(due);
        const alreadyPaid = await tx.transaction.findFirst({
          where: { subscriptionId: sub.id, date: { gte: start, lte: end } },
          select: { id: true },
        });
        if (alreadyPaid) return false;

        await tx.transaction.create({
          data: {
            userId: sub.userId,
            type: "EXPENSE",
            amount,
            date: due,
            description: sub.name,
            categoryId: sub.categoryId,
            accountId: sub.accountId,
            subscriptionId: sub.id,
            ...(converted && {
              originalAmount: sub.amount,
              originalCurrency: sub.currency,
              exchangeRate: charge!.rate,
            }),
          },
        });
        await applyBalanceDeltas(
          tx,
          balanceEffects({
            type: "EXPENSE",
            amount,
            accountId: sub.accountId,
            accountType: sub.account.type,
          })
        );
        return true;
      });

      if (didCharge === null) break;
      if (didCharge) charged++;
      current = next;
      due = next;
    }
  }
  return charged;
}

/**
 * Revisa los cobros al arrancar y luego cada hora, para que se registren
 * aunque nadie abra la app. Una sola vez por proceso.
 */
export function startSubscriptionScheduler() {
  const g = globalThis as unknown as { __subscriptionScheduler?: boolean };
  if (g.__subscriptionScheduler) return;
  g.__subscriptionScheduler = true;

  const run = () =>
    chargeDueSubscriptions()
      .then((n) => {
        if (n > 0) console.log(`Suscripciones: ${n} cobro(s) registrado(s)`);
      })
      .catch((error) => console.error("No se pudieron cobrar las suscripciones:", error));

  void run();
  setInterval(run, 60 * 60 * 1000).unref();
}
