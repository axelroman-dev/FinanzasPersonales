import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { seedDefaultCategories } from "@/lib/categories";
import { generateSetupCode, hashSetupCode, setupCodeMatches } from "@/lib/setup-code";
import { MAX_SETUP_ATTEMPTS, type SetupInput } from "@/lib/setup-rules";

/**
 * Configuración inicial: mientras no exista ningún admin, la app pide un
 * código que solo se muestra en los logs del servidor. Quien lo tiene crea la
 * cuenta de admin desde /setup.
 */

const CONFIG_ID = "singleton";

export async function hasAdmin(): Promise<boolean> {
  return (await prisma.user.count({ where: { role: "ADMIN" } })) > 0;
}

/**
 * Se llama al arrancar el servidor (src/instrumentation.ts). Si no hay admin,
 * genera un código nuevo, guarda su hash y lo imprime en los logs.
 */
export async function startSetupIfNeeded(): Promise<void> {
  if (await hasAdmin()) return;

  const code = generateSetupCode();
  await prisma.appConfig.upsert({
    where: { id: CONFIG_ID },
    update: { setupCodeHash: hashSetupCode(code), setupAttempts: 0 },
    create: { id: CONFIG_ID, setupCodeHash: hashSetupCode(code) },
  });

  console.log(
    [
      "",
      "═══════════════════════════════════════════",
      "  Configuración inicial pendiente",
      "",
      `  Código de configuración: ${code}`,
      "",
      "  Abre la app en el navegador y úsalo para crear",
      "  la cuenta de administrador. Se genera uno nuevo",
      "  en cada reinicio mientras no exista un admin.",
      "═══════════════════════════════════════════",
      "",
    ].join("\n")
  );
}

export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: "no-code" }
  | { ok: false; reason: "invalid"; remaining: number };

/**
 * Verifica el código sin consumirlo. Cada intento fallido cuenta; al llegar a
 * MAX_SETUP_ATTEMPTS el código se invalida y hay que reiniciar el servidor.
 */
export async function checkSetupCode(code: string): Promise<CodeCheck> {
  const config = await prisma.appConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!config?.setupCodeHash) return { ok: false, reason: "no-code" };
  if (setupCodeMatches(code, config.setupCodeHash)) return { ok: true };

  const { setupAttempts } = await prisma.appConfig.update({
    where: { id: CONFIG_ID },
    data: { setupAttempts: { increment: 1 } },
  });
  const remaining = Math.max(0, MAX_SETUP_ATTEMPTS - setupAttempts);
  if (remaining === 0) {
    await prisma.appConfig.update({
      where: { id: CONFIG_ID },
      data: { setupCodeHash: null },
    });
    console.warn(
      "⚠️  Código de configuración invalidado por demasiados intentos. " +
        "Reinicia el contenedor para generar uno nuevo."
    );
    return { ok: false, reason: "no-code" };
  }
  return { ok: false, reason: "invalid", remaining };
}

export class SetupError extends Error {
  constructor(
    public reason: "already-done" | "code" | "email-taken",
    message: string
  ) {
    super(message);
  }
}

/**
 * Crea el admin y guarda la configuración de registro. Consumir el código
 * (borrar su hash) va en la misma transacción que crear el usuario: si dos
 * personas envían el formulario a la vez, solo una lo logra.
 */
export async function completeSetup(input: SetupInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const codeHash = hashSetupCode(input.code);

  const admin = await prisma.$transaction(async (tx) => {
    const consumed = await tx.appConfig.updateMany({
      where: { id: CONFIG_ID, setupCodeHash: codeHash },
      data: { setupCodeHash: null, setupAttempts: 0 },
    });
    if (consumed.count !== 1) {
      throw new SetupError("code", "El código de configuración ya no es válido");
    }
    if ((await tx.user.count({ where: { role: "ADMIN" } })) > 0) {
      throw new SetupError("already-done", "La configuración inicial ya se completó");
    }
    if (await tx.user.findUnique({ where: { email: input.email } })) {
      throw new SetupError("email-taken", "Ya existe una cuenta con ese email");
    }

    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });
    await tx.appConfig.update({
      where: { id: CONFIG_ID },
      data: { allowRegistration: input.allowRegistration, updatedById: user.id },
    });
    return user;
  });

  await seedDefaultCategories(admin.id);
  return admin;
}
