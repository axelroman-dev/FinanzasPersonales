/**
 * Lectura de searchParams de la URL. Vienen del usuario tal cual, así que
 * un valor raro (?type=foo, ?from=abc, ?type=A&type=B) se ignora en vez de
 * llegar a Prisma y tirar un 500.
 */

type Param = string | string[] | undefined;

/** Primer valor: un parámetro repetido llega como arreglo */
export function firstParam(value: Param): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v || undefined;
}

/** Fecha "YYYY-MM-DD" que exista en el calendario (no 2026-02-31) */
export function dateParam(value: Param): string | undefined {
  const v = firstParam(value);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(v) ? v : undefined;
}

/** Valor de una lista cerrada (p. ej. un enum de Prisma) */
export function enumParam<T extends string>(value: Param, allowed: readonly T[]): T | undefined {
  const v = firstParam(value);
  return allowed.find((a) => a === v);
}
