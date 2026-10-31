import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { allowedCurrencies } from "@/lib/currencies";
import { normalizeUrl } from "@/lib/wishlist";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  // Vacío = sin link
  url: z.string().max(2000).nullable().optional(),
  price: z.number().positive(),
  currency: z.string().length(3),
  targetPrice: z.number().positive().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const { name, price, currency, targetPrice } = parsed.data;

    const rawUrl = parsed.data.url?.trim() || null;
    const url = rawUrl ? normalizeUrl(rawUrl) : null;
    if (rawUrl && !url) {
      return NextResponse.json({ error: "El link no es válido" }, { status: 400 });
    }
    if (!allowedCurrencies(user).includes(currency)) {
      return NextResponse.json(
        { error: `Agrega ${currency} a tus monedas en Mi perfil para usarla` },
        { status: 400 }
      );
    }

    const item = await prisma.wishlistItem.create({
      data: { userId: user.id, name, url, price, currency, targetPrice: targetPrice ?? null },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Create wishlist item error:", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
