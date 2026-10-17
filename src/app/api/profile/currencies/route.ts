import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeCurrencySettings } from "@/lib/currencies";
import { RATE_PROVIDERS, RATE_PROVIDER_IDS } from "@/lib/rate-providers";
import { testProvider, validateCustomUrl } from "@/lib/exchange-rates";
import { serverBanxicoToken } from "@/lib/onboarding";

const schema = z.object({
  primaryCurrency: z.string().length(3),
  secondaryCurrencies: z.array(z.string().length(3)).max(30),
  ratesProvider: z.enum(RATE_PROVIDER_IDS),
  // Solo CUSTOM
  ratesProviderUrl: z.string().trim().max(500).nullable().optional(),
  // Solo BANXICO: sin el campo se conserva el guardado; null lo borra
  banxicoToken: z.string().trim().max(200).nullable().optional(),
  // Solo MANUAL: 1 unidad de cada secundaria vale N de la principal
  manualRates: z.record(z.number().positive().finite()).optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const data = parsed.data;
    const provider = RATE_PROVIDERS[data.ratesProvider];

    const inUse = await prisma.account.findMany({
      where: { userId: user.id },
      select: { currency: true },
      distinct: ["currency"],
    });
    const result = normalizeCurrencySettings({
      primary: data.primaryCurrency,
      secondary: data.secondaryCurrencies,
      previousPrimary: user.primaryCurrency,
      inUse: inUse.map((a) => a.currency),
      supported: provider.currencies,
      providerLabel: provider.label,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const { primaryCurrency, secondaryCurrencies } = result.settings;

    const update: Record<string, unknown> = {
      primaryCurrency,
      secondaryCurrencies,
      ratesProvider: data.ratesProvider,
      ratesProviderUrl: null,
      onboardedAt: user.onboardedAt ?? new Date(),
    };

    let url: string | null = null;
    if (data.ratesProvider === "CUSTOM") {
      url = data.ratesProviderUrl || null;
      if (!url) {
        return NextResponse.json({ error: "Escribe la URL del proveedor" }, { status: 400 });
      }
      const invalid = await validateCustomUrl(url);
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
      update.ratesProviderUrl = url;
    }

    let token: string | null = null;
    if (data.ratesProvider === "BANXICO" || data.banxicoToken !== undefined) {
      const saved = await prisma.user.findUnique({
        where: { id: user.id },
        select: { banxicoToken: true },
      });
      token = data.banxicoToken === undefined ? saved?.banxicoToken ?? null : data.banxicoToken || null;
      if (data.banxicoToken !== undefined) update.banxicoToken = token;
      if (data.ratesProvider === "BANXICO" && !token && !serverBanxicoToken()) {
        return NextResponse.json(
          { error: "Escribe tu token del SIE de Banxico" },
          { status: 400 }
        );
      }
    }

    if (data.ratesProvider === "MANUAL") {
      const rates: Record<string, number> = {};
      const missing: string[] = [];
      for (const code of secondaryCurrencies) {
        const rate = data.manualRates?.[code];
        if (rate) rates[code] = rate;
        else missing.push(code);
      }
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Escribe el tipo de cambio de ${missing.join(", ")}` },
          { status: 400 }
        );
      }
      update.manualRates = { base: primaryCurrency, rates };
      update.manualRatesAt = new Date();
    }

    // Antes de guardar, comprobar que el proveedor responde con esta configuración
    const test = await testProvider(data.ratesProvider, primaryCurrency, secondaryCurrencies, {
      url,
      token,
    });
    if (!test.ok) {
      return NextResponse.json({ error: test.error }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: update,
      select: {
        primaryCurrency: true,
        secondaryCurrencies: true,
        ratesProvider: true,
        ratesProviderUrl: true,
        banxicoToken: true,
      },
    });
    const { banxicoToken, ...rest } = updated;
    return NextResponse.json({
      ...rest,
      hasBanxicoToken: !!banxicoToken,
      warning:
        test.missing.length > 0
          ? `${provider.label} no devolvió el tipo de cambio de ${test.missing.join(", ")}: no se incluirán en los totales`
          : null,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Update currencies error:", error);
    return NextResponse.json({ error: "Error al guardar las monedas" }, { status: 500 });
  }
}
