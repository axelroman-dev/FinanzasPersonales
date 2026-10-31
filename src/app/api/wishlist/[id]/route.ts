import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { allowedCurrencies } from "@/lib/currencies";
import { normalizeUrl } from "@/lib/wishlist";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  url: z.string().max(2000).nullable().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  targetPrice: z.number().positive().nullable().optional(),
  purchased: z.boolean().optional(),
});

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUser();
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const existing = await prisma.wishlistItem.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const { name, price, currency, targetPrice, purchased } = parsed.data;

    let url: string | null | undefined;
    if (parsed.data.url !== undefined) {
      const rawUrl = parsed.data.url?.trim() || null;
      url = rawUrl ? normalizeUrl(rawUrl) : null;
      if (rawUrl && !url) {
        return NextResponse.json({ error: "El link no es válido" }, { status: 400 });
      }
    }
    if (
      currency !== undefined &&
      currency !== existing.currency &&
      !allowedCurrencies(user).includes(currency)
    ) {
      return NextResponse.json(
        { error: `Agrega ${currency} a tus monedas en Mi perfil para usarla` },
        { status: 400 }
      );
    }

    // Precio nuevo (o en otra moneda): el actual pasa a ser el anterior. En
    // otra moneda no se comparan, así que se descarta el anterior
    const currencyChanged = currency !== undefined && currency !== existing.currency;
    const priceChanged = price !== undefined && price !== Number(existing.price);
    const priceData = currencyChanged
      ? { previousPrice: null, priceUpdatedAt: new Date() }
      : priceChanged
        ? { previousPrice: existing.price, priceUpdatedAt: new Date() }
        : {};

    const item = await prisma.wishlistItem.update({
      where: { id: existing.id },
      data: {
        name,
        url,
        price,
        currency,
        targetPrice,
        ...priceData,
        ...(purchased !== undefined && {
          purchasedAt: purchased ? (existing.purchasedAt ?? new Date()) : null,
        }),
      },
    });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Update wishlist item error:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUser();
    const { count } = await prisma.wishlistItem.deleteMany({
      where: { id: params.id, userId: user.id },
    });
    if (count === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete wishlist item error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
