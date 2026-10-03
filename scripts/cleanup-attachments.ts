/**
 * Borra los archivos de adjuntos que ya no tienen registro en la base de datos
 * (p. ej. si el servidor se cayó entre borrar el registro y el archivo).
 *
 * Por defecto solo lista lo que borraría; con --apply los borra.
 *
 * Uso:
 *   npx tsx scripts/cleanup-attachments.ts [--apply]
 *
 * En Docker:
 *   docker compose exec app npx tsx scripts/cleanup-attachments.ts [--apply]
 *
 * Autocontenido a propósito: en la imagen de Docker no está src/.
 */
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = path.resolve(process.env.ATTACHMENTS_DIR || path.join(process.cwd(), "data", "uploads"));
const apply = process.argv.includes("--apply");
const USER_RE = /^[a-z0-9]+$/;
const FILE_RE = /^[0-9a-f-]{36}\.bin$/;
// Temporales de escrituras interrumpidas (ver src/lib/storage/local.ts)
const TMP_RE = /^[0-9a-f-]{36}\.bin\.[0-9a-f-]{36}\.tmp$/;

async function main() {
  const known = new Set(
    (await prisma.attachment.findMany({ select: { storageKey: true } })).map((a) => a.storageKey)
  );

  let users: string[] = [];
  try {
    users = await readdir(root);
  } catch {
    console.log(`No existe la carpeta de adjuntos: ${root}`);
    return;
  }

  const orphans: string[] = [];
  for (const user of users.filter((u) => USER_RE.test(u))) {
    const dir = path.join(root, user);
    if (!(await stat(dir)).isDirectory()) continue;
    for (const file of await readdir(dir)) {
      const isOrphan = FILE_RE.test(file)
        ? !known.has(`${user}/${file.replace(/\.bin$/, "")}`)
        : TMP_RE.test(file);
      if (isOrphan) orphans.push(path.join(dir, file));
    }
  }

  if (orphans.length === 0) {
    console.log("No hay archivos huérfanos.");
    return;
  }
  for (const file of orphans) {
    console.log(`${apply ? "Borrando" : "Huérfano"}: ${path.relative(root, file)}`);
    if (apply) await rm(file, { force: true });
  }
  console.log(
    apply
      ? `Se borraron ${orphans.length} archivo(s).`
      : `${orphans.length} archivo(s) huérfano(s). Corre con --apply para borrarlos.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
