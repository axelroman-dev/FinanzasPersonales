import type { Converter } from "@/lib/exchange-rates";
import { formatDate } from "@/lib/utils";

/**
 * Nota bajo los totales cuando hay cuentas en monedas secundarias: de cuándo
 * es el tipo de cambio y qué monedas no se pudieron convertir.
 */
export function RatesNotice({ converter }: { converter: Converter }) {
  const missing = [...converter.missing];
  if (!converter.fetchedAt && missing.length === 0) return null;

  return (
    <p className="text-xs text-muted-foreground">
      Totales en {converter.base}
      {converter.fetchedAt && (
        <>
          {" "}al tipo de cambio de {converter.provider} del{" "}
          {formatDate(converter.fetchedAt)}
        </>
      )}
      .
      {missing.length > 0 && (
        <span className="text-amber-400">
          {" "}Sin tipo de cambio para {missing.join(", ")}: no se incluye en los totales.
        </span>
      )}
    </p>
  );
}
