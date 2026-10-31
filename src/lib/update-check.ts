/**
 * Aviso de nueva versión: compara la versión instalada (package.json, fijada
 * al compilar) con el tag X.Y.Z más alto publicado en Docker Hub. El resultado
 * se guarda en memoria y se refresca en segundo plano, así el layout no espera
 * a Docker Hub en cada request. Se desactiva con UPDATE_CHECK=false.
 */

const TAGS_URL =
  "https://hub.docker.com/v2/namespaces/axelromandev/repositories/finanzas-personales/tags?page_size=100&ordering=last_updated";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
// La primera consulta tras arrancar espera poco; si tarda más, el aviso sale
// en la siguiente carga
const FIRST_WAIT_MS = 1500;

export type UpdateInfo = { current: string; latest: string };

type Version = [number, number, number];

/** "1.2.3" → [1, 2, 3]; null si no es una versión completa */
export function parseVersion(value: string): Version | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Versión más alta entre los tags (ignora latest, 0.18, etc.) */
export function latestVersionFromTags(json: unknown): string | null {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return null;
  let best: Version | null = null;
  for (const tag of results) {
    const name = (tag as { name?: unknown })?.name;
    const v = typeof name === "string" ? parseVersion(name) : null;
    if (v && (!best || compareVersions(v, best) > 0)) best = v;
  }
  return best ? best.join(".") : null;
}

/** Hay actualización si latest es estrictamente mayor que current */
export function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  return !!l && !!c && compareVersions(l, c) > 0;
}

let cachedLatest: string | null = null;
let nextCheckAt = 0;
let inFlight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const res = await fetch(TAGS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Docker Hub respondió ${res.status}`);
    const latest = latestVersionFromTags(await res.json());
    if (!latest) throw new Error("Docker Hub no devolvió versiones");
    cachedLatest = latest;
    nextCheckAt = Date.now() + CHECK_INTERVAL_MS;
  } catch (err) {
    console.warn("[update-check] No se pudo consultar la última versión:", err);
    nextCheckAt = Date.now() + RETRY_AFTER_FAILURE_MS;
  } finally {
    inFlight = null;
  }
}

/** Versión nueva disponible, o null si está al día o no se pudo saber */
export async function getAvailableUpdate(): Promise<UpdateInfo | null> {
  const current = process.env.NEXT_PUBLIC_APP_VERSION;
  if (!current || process.env.UPDATE_CHECK === "false") return null;

  if (Date.now() >= nextCheckAt && !inFlight) {
    inFlight = refresh();
    if (cachedLatest === null) {
      await Promise.race([
        inFlight,
        new Promise((resolve) => setTimeout(resolve, FIRST_WAIT_MS)),
      ]);
    }
  }

  return cachedLatest && isNewer(cachedLatest, current)
    ? { current, latest: cachedLatest }
    : null;
}
