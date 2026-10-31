import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Heart, Pencil, Plus } from "lucide-react";
import { WishlistActions } from "@/components/wishlist/wishlist-actions";
import { getConverter } from "@/lib/exchange-rates";
import { RatesNotice } from "@/components/shared/rates-notice";
import { allowedCurrencies } from "@/lib/currencies";
import {
  priceChangePercent,
  reachedTarget,
  storeLabel,
  summarizeWishlist,
} from "@/lib/wishlist";

export default async function WishlistPage() {
  const user = await requireUser();
  const currencies = allowedCurrencies(user);
  const rows = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }],
  });
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    price: Number(r.price),
    currency: r.currency,
    previousPrice: r.previousPrice === null ? null : Number(r.previousPrice),
    targetPrice: r.targetPrice === null ? null : Number(r.targetPrice),
    priceUpdatedAt: r.priceUpdatedAt,
    purchased: r.purchasedAt !== null,
  }));

  const converter = await getConverter(user.id, user, [
    ...new Set(items.filter((i) => !i.purchased).map((i) => i.currency)),
  ]);
  const summary = summarizeWishlist(items, (amount, currency) =>
    converter.toBase(amount, currency)
  );
  const pending = items.filter((i) => !i.purchased);
  const purchased = items.filter((i) => i.purchased);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Wishlist</h1>
          <p className="text-muted-foreground">
            Lo que quieres comprar, con su link para ir a verlo
          </p>
        </div>
        <WishlistActions mode="create" currencies={currencies}>
          <Button>
            <Plus className="h-4 w-4" />
            Agregar producto
          </Button>
        </WishlistActions>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Total de la wishlist
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {formatCurrency(summary.total, user.primaryCurrency)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Por comprar</p>
              <p className="font-semibold tabular-nums">{summary.pendingCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">En tu precio objetivo</p>
              <p className="font-semibold text-emerald-400 tabular-nums">
                {summary.atTargetCount}
              </p>
            </div>
          </div>
          <div className="pt-3 border-t space-y-1">
            <p className="text-xs text-muted-foreground">
              Los precios se actualizan a mano: abre el link, revisa el precio y edítalo. El
              anterior se guarda para ver si bajó. Lo que marques como comprado deja de sumar.
            </p>
            <RatesNotice converter={converter} />
          </div>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Tu wishlist está vacía</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Pega el link de un producto de Amazon, MercadoLibre o cualquier tienda
            </p>
            <WishlistActions mode="create" currencies={currencies}>
              <Button>
                <Plus className="h-4 w-4" />
                Agregar el primero
              </Button>
            </WishlistActions>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {pending.map((item) => (
          <WishlistRow key={item.id} item={item} currencies={currencies} />
        ))}
      </div>

      {purchased.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Comprados
          </h2>
          {purchased.map((item) => (
            <WishlistRow key={item.id} item={item} currencies={currencies} />
          ))}
        </div>
      )}
    </div>
  );
}

function WishlistRow({
  item,
  currencies,
}: {
  item: {
    id: string;
    name: string;
    url: string | null;
    price: number;
    currency: string;
    previousPrice: number | null;
    targetPrice: number | null;
    priceUpdatedAt: Date;
    purchased: boolean;
  };
  currencies: string[];
}) {
  const change = priceChangePercent(item.price, item.previousPrice);
  const atTarget = !item.purchased && reachedTarget(item.price, item.targetPrice);

  return (
    <Card className={item.purchased ? "opacity-60" : ""}>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium truncate">{item.name}</p>
            {item.purchased ? (
              <Badge variant="secondary" className="text-xs">
                Comprado
              </Badge>
            ) : atTarget ? (
              <Badge variant="success" className="text-xs">
                En tu precio objetivo
              </Badge>
            ) : null}
            {!item.purchased && change !== null && (
              <Badge variant={change < 0 ? "success" : "warning"} className="text-xs">
                {change < 0 ? "Bajó" : "Subió"} {Math.abs(change).toFixed(0)}%
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.url ? storeLabel(item.url) : "Sin link"}
            {` • Precio del ${formatShortDate(item.priceUpdatedAt)}`}
            {item.previousPrice !== null &&
              change !== null &&
              ` • Antes ${formatCurrency(item.previousPrice, item.currency)}`}
            {item.targetPrice !== null &&
              ` • Objetivo ${formatCurrency(item.targetPrice, item.currency)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <p className="mr-2 text-lg font-semibold tabular-nums">
            {formatCurrency(item.price, item.currency)}
          </p>
          {item.url && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${item.name} en ${storeLabel(item.url)}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <WishlistActions
            mode="edit"
            currencies={currencies}
            item={{
              id: item.id,
              name: item.name,
              url: item.url,
              price: item.price,
              currency: item.currency,
              targetPrice: item.targetPrice,
              purchased: item.purchased,
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Editar ${item.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </WishlistActions>
        </div>
      </CardContent>
    </Card>
  );
}
