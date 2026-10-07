import { prisma } from "@/lib/db";
import { excludeInternal } from "@/lib/internal-categories";

/** Tope de descripciones distintas que se mandan al formulario */
const MAX_KNOWN = 300;

/**
 * Descripciones que el usuario ya usó, de la más usada a la menos (a igual
 * uso, la más reciente primero). Deja fuera las del sistema (ajustes, pagos
 * de tarjeta) y las de MSI, que llevan "(MSI 3x)" o "Mensualidad 2/3".
 */
export async function getKnownDescriptions(userId: string): Promise<string[]> {
  const rows = await prisma.transaction.groupBy({
    by: ["description"],
    where: { userId, isMsi: false, ...excludeInternal },
    _count: { _all: true },
    _max: { date: true },
    orderBy: [{ _count: { description: "desc" } }, { _max: { date: "desc" } }],
    take: MAX_KNOWN,
  });
  return rows.map((r) => r.description).filter((d) => d.trim() !== "");
}
