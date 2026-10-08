/**
 * Límite de solicitudes en memoria (ventana deslizante). Basta con un solo
 * servidor; se reinicia al reiniciar la app.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** true si `key` todavía puede hacer otra solicitud (y la cuenta) */
    take(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      // Que el mapa no crezca sin fin con IPs viejas
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      }
      return true;
    },
  };
}

/** IP del cliente detrás del proxy inverso */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desconocida"
  );
}
