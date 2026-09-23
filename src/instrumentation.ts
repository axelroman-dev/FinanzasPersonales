/**
 * Hook de arranque de Next.js: si todavía no hay admin, genera el código de
 * configuración inicial y lo imprime en los logs (ver src/lib/setup.ts).
 */
export async function register() {
  // El import va dentro del if para que no se incluya en el bundle edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startSetupIfNeeded } = await import("@/lib/setup");
      await startSetupIfNeeded();
    } catch (error) {
      // Sin DB no se puede verificar; no impedir que el servidor arranque
      console.error("No se pudo preparar la configuración inicial:", error);
    }
  }
}
