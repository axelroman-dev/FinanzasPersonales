/**
 * Hook de arranque de Next.js: crea o sincroniza el admin del sistema con la
 * contraseña de ADMIN_PASSWORD (ver src/lib/system-admin.ts).
 */
export async function register() {
  // El import va dentro del if para que no se incluya en el bundle edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSystemAdmin, getAdminPassword } = await import(
      "@/lib/system-admin"
    );
    // Sin ADMIN_PASSWORD válida no hay forma de entrar: no arrancar
    const password = getAdminPassword();
    try {
      await ensureSystemAdmin(password);
    } catch (error) {
      // Sin DB no se puede verificar; no impedir que el servidor arranque
      console.error("No se pudo preparar el admin del sistema:", error);
    }
  }
}
