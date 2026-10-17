"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_SECONDARY_CURRENCIES, currencyLabel } from "@/lib/currencies";
import {
  RATE_PROVIDERS,
  RATE_PROVIDER_IDS,
  type ManualRates,
  type RateProviderId,
} from "@/lib/rate-providers";

function options(codes: readonly string[]) {
  return [
    {
      key: "all",
      options: codes.map((code) => ({
        value: code,
        label: currencyLabel(code),
        keywords: [currencyLabel(code)],
      })),
    },
  ];
}

export function CurrencySettingsForm({
  initialPrimary,
  initialSecondary,
  initialProvider,
  initialUrl,
  initialManualRates,
  hasBanxicoToken,
  serverBanxicoToken,
  defaultProvider,
  inUse,
  mode = "profile",
}: {
  initialPrimary: string;
  initialSecondary: string[];
  initialProvider: RateProviderId;
  initialUrl: string | null;
  initialManualRates: ManualRates | null;
  /** El usuario ya guardó un token de Banxico (nunca se manda el token) */
  hasBanxicoToken: boolean;
  /** El servidor tiene BANXICO_TOKEN: el token del usuario es opcional */
  serverBanxicoToken: boolean;
  /** El que sugiere el servidor (Banxico si tiene BANXICO_TOKEN) */
  defaultProvider: RateProviderId;
  /** Monedas de las cuentas del usuario: no se pueden quitar */
  inUse: string[];
  /** "welcome": configuración inicial; al guardar entra a la app */
  mode?: "profile" | "welcome";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [primary, setPrimary] = useState(initialPrimary);
  const [secondary, setSecondary] = useState(initialSecondary);
  const [provider, setProvider] = useState<RateProviderId>(initialProvider);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState(hasBanxicoToken);
  // Lo guardado, para volver a ello al cancelar un cambio de proveedor
  const [savedProvider, setSavedProvider] = useState<RateProviderId>(initialProvider);
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? "");
  // El proveedor se muestra como resumen; el selector solo al cambiarlo. Se
  // abre solo si al elegido le falta algo (token de Banxico o URL)
  const [editingProvider, setEditingProvider] = useState(
    (initialProvider === "BANXICO" && !hasBanxicoToken && !serverBanxicoToken) ||
      (initialProvider === "CUSTOM" && !initialUrl)
  );

  function cancelProviderChange() {
    setProvider(savedProvider);
    setUrl(savedUrl);
    setToken("");
    setEditingProvider(false);
  }
  // Texto de cada campo manual: "1 USD = ___ MXN"
  const [manual, setManual] = useState<Record<string, string>>(() =>
    initialManualRates && initialManualRates.base === initialPrimary
      ? Object.fromEntries(
          Object.entries(initialManualRates.rates).map(([c, r]) => [c, String(r)])
        )
      : {}
  );

  const supported = RATE_PROVIDERS[provider].currencies;
  const unsupported = [primary, ...secondary].filter(
    (c) => !supported.includes(c) && !inUse.includes(c)
  );

  function changePrimary(code: string) {
    // La principal anterior queda como secundaria si alguna cuenta la usa
    if (inUse.includes(primary) && !secondary.includes(primary)) {
      setSecondary([...secondary.filter((c) => c !== code), primary]);
    } else {
      setSecondary(secondary.filter((c) => c !== code));
    }
    // Las tasas manuales eran contra la principal anterior
    if (code !== primary) setManual({});
    setPrimary(code);
  }

  const addable = supported.filter((c) => c !== primary && !secondary.includes(c));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const manualRates: Record<string, number> = {};
    if (provider === "MANUAL") {
      for (const code of secondary) {
        const value = Number(manual[code]);
        if (!(value > 0)) {
          setError(`Escribe el tipo de cambio de ${code}`);
          return;
        }
        manualRates[code] = value;
      }
    }

    startTransition(async () => {
      const res = await fetch("/api/profile/currencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryCurrency: primary,
          secondaryCurrencies: secondary,
          ratesProvider: provider,
          ratesProviderUrl: provider === "CUSTOM" ? url : null,
          ...(token && { banxicoToken: token }),
          ...(provider === "MANUAL" && { manualRates }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al guardar");
        // El proveedor no respondió (p. ej. token inválido): mostrar el selector
        if (String(data.error ?? "").startsWith("No se pudo consultar")) {
          setEditingProvider(true);
        }
        return;
      }
      if (mode === "welcome") {
        router.push("/");
        router.refresh();
        return;
      }
      setSecondary(data.secondaryCurrencies);
      setSavedToken(data.hasBanxicoToken);
      setToken("");
      setSavedProvider(data.ratesProvider);
      setSavedUrl(data.ratesProviderUrl ?? "");
      setEditingProvider(false);
      setNotice(data.warning ?? null);
      if (!data.warning) setNotice("Monedas actualizadas");
      router.refresh();
    });
  }

  async function removeToken() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/profile/currencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Sin token Banxico ya no sirve: se vuelve al BCE
        body: JSON.stringify({
          primaryCurrency: primary,
          secondaryCurrencies: secondary,
          ratesProvider: provider === "BANXICO" ? "ECB" : provider,
          ratesProviderUrl: provider === "CUSTOM" ? url : null,
          banxicoToken: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al quitar el token");
        return;
      }
      setSavedToken(false);
      setProvider(data.ratesProvider);
      setSavedProvider(data.ratesProvider);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={editingProvider ? "rates-provider" : undefined}>Tipo de cambio</Label>
        {!editingProvider ? (
          // Resumen del proveedor elegido; el selector solo si se quiere cambiar
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {RATE_PROVIDERS[provider].label}
                {provider === defaultProvider && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (predeterminado)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {RATE_PROVIDERS[provider].description}
              </p>
              {provider === "BANXICO" && (
                <p className="text-xs text-muted-foreground">
                  {savedToken
                    ? "Con tu token del SIE"
                    : serverBanxicoToken
                      ? "Con el token del servidor"
                      : "Falta el token del SIE"}
                </p>
              )}
              {provider === "CUSTOM" && url && (
                <p className="truncate text-xs text-muted-foreground" title={url}>
                  {url}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setEditingProvider(true)}
            >
              Cambiar proveedor
            </Button>
          </div>
        ) : (
          <>
            <Select value={provider} onValueChange={(v) => setProvider(v as RateProviderId)}>
              <SelectTrigger id="rates-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATE_PROVIDER_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {RATE_PROVIDERS[id].label}
                    {id === defaultProvider && " (predeterminado)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {RATE_PROVIDERS[provider].description}
            </p>
          </>
        )}
        {unsupported.length > 0 && (
          <p className="text-xs text-amber-400">
            {RATE_PROVIDERS[provider].label} no publica {unsupported.join(", ")}
          </p>
        )}
      </div>

      {editingProvider && provider === "BANXICO" && (
        <div className="space-y-2">
          <Label htmlFor="banxico-token">Token del SIE</Label>
          <Input
            id="banxico-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={savedToken ? "Guardado (escribe otro para cambiarlo)" : "Pega tu token"}
          />
          <p className="text-xs text-muted-foreground">
            Pídelo gratis en{" "}
            <a
              href="https://www.banxico.org.mx/SieAPIRest/service/v1/token"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              banxico.org.mx
            </a>
            .{" "}
            {serverBanxicoToken && !savedToken && "Opcional: el servidor ya tiene uno."}
            {savedToken && (
              <button
                type="button"
                onClick={removeToken}
                className="text-primary hover:underline"
                disabled={isPending}
              >
                Quitar token guardado
              </button>
            )}
          </p>
        </div>
      )}

      {editingProvider && provider === "CUSTOM" && (
        <div className="space-y-2">
          <Label htmlFor="rates-url">URL</Label>
          <Input
            id="rates-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mi-servidor.com/latest?base={base}&symbols={symbols}"
            required
          />
          <p className="text-xs text-muted-foreground">
            {"{base}"} y {"{symbols}"} se reemplazan por la moneda principal y las
            secundarias. Sin ellos se agregan como <code>?base=…&amp;symbols=…</code>.
            Debe responder <code>{'{ "rates": { "USD": 0.054 } }'}</code> (1 de la
            principal = N de cada secundaria).
          </p>
        </div>
      )}

      {editingProvider && (
        <button
          type="button"
          onClick={cancelProviderChange}
          className="-mt-2 text-xs text-primary hover:underline"
        >
          Cancelar cambio de proveedor
        </button>
      )}

      <div className="space-y-2">
        <Label>Moneda principal</Label>
        <Combobox
          groups={options(supported)}
          value={primary}
          onChange={changePrimary}
          selected={currencyLabel(primary)}
          searchPlaceholder="Buscar moneda…"
          emptyText="Ninguna moneda coincide"
        />
        <p className="text-xs text-muted-foreground">
          Los totales y reportes se muestran en esta moneda
        </p>
      </div>

      <div className="space-y-2">
        <Label>Monedas secundarias</Label>
        {secondary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {secondary.map((code) => {
              const locked = inUse.includes(code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                  title={locked ? "Hay cuentas en esta moneda" : undefined}
                >
                  {currencyLabel(code)}
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => setSecondary(secondary.filter((c) => c !== code))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Quitar ${code}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {secondary.length < MAX_SECONDARY_CURRENCIES && (
          <Combobox
            groups={options(addable)}
            value=""
            onChange={(code) => setSecondary([...secondary, code])}
            placeholder="Agregar moneda…"
            searchPlaceholder="Buscar moneda…"
            emptyText="Ninguna moneda coincide"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Tus cuentas pueden estar en la principal o en una secundaria; sus saldos
          se convierten a la principal.
        </p>
      </div>

      {provider === "MANUAL" && (
        <div className="space-y-2">
          {secondary.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Agrega una moneda secundaria para escribir su tipo de cambio
            </p>
          ) : (
            secondary.map((code) => (
              <div key={code} className="flex items-center gap-2 text-sm">
                <Label htmlFor={`rate-${code}`} className="w-16 shrink-0">
                  1 {code} =
                </Label>
                <Input
                  id={`rate-${code}`}
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={manual[code] ?? ""}
                  onChange={(e) => setManual({ ...manual, [code]: e.target.value })}
                  required
                />
                <span className="shrink-0 text-muted-foreground">{primary}</span>
              </div>
            ))
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
          {notice}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "welcome" ? "Continuar" : "Guardar monedas"}
      </Button>
    </form>
  );
}
