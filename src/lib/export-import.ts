import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { deleteStoredFiles, processUpload, sanitizeName } from "@/lib/attachments";
import { MAX_ATTACHMENTS_PER_TRANSACTION } from "@/lib/attachment-rules";
import { attachmentPath } from "@/lib/backup-file";
import { encrypt, getAttachmentsKey } from "@/lib/storage/crypto";
import { newStorageKey } from "@/lib/storage/keys";
import { getStorage } from "@/lib/storage/storage";
import { normalizeCategoryIcon } from "@/lib/category-icons";
import { defaultSubcategoryIcon } from "../../prisma/default-categories";

/**
 * Estructura del JSON de export/import.
 * Versionado: si en el futuro cambia el formato, podemos detectar
 * la versión del archivo y migrar/avisar al usuario.
 */
export type ExportVersion = "1.0" | "1.1";

/** 1.1 añade los adjuntos de los movimientos (respaldo en .zip) */
const CURRENT_VERSION = "1.1";
const SUPPORTED_VERSIONS: string[] = ["1.0", "1.1"];

function isSupportedVersion(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

export type ExportData = {
  version: ExportVersion;
  exportedAt: string;
  scope: "user" | "global";
  data: {
    accounts: ExportAccount[];
    transactions: ExportTransaction[];
    subscriptions: ExportSubscription[];
    categories: ExportCategory[];
  };
};

export type ExportAccount = {
  id: string;
  name: string;
  type: "DEBIT" | "CREDIT" | "SAVINGS" | "VOUCHER";
  balance: number;
  currency: string;
  includeInBalance: boolean;
  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDay: number | null;
  createdAt: string;
};

export type ExportTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  description: string;
  category: string | null;
  categoryName: string | null; // nombre para resolver al importar
  // Padre de la categoría: distingue subcategorías con el mismo nombre (p. ej.
  // "Servicios" raíz y "Vivienda › Servicios"). Los exports anteriores no lo
  // tienen; en ese caso se resuelve solo por nombre, prefiriendo la raíz.
  categoryParentName?: string | null;
  accountName: string; // nombre para resolver al importar
  transferAccountName: string | null;
  isMsi: boolean;
  msiParentId: string | null;
  msiTotalAmount: number | null;
  msiInstallments: number | null;
  subscriptionName: string | null;
  createdAt: string;
  /** Desde 1.1. Los archivos van en el zip, en la ruta `file` */
  attachments?: ExportAttachment[];
};

export type ExportAttachment = {
  file: string;
  name: string;
  mimeType: string;
};

export type ExportSubscription = {
  id: string;
  name: string;
  amount: number;
  billingDay: number;
  /** Exports anteriores no lo traen: mensual */
  frequency?: "MONTHLY" | "YEARLY";
  /** 1-12, solo en las anuales */
  billingMonth?: number | null;
  categoryName?: string | null;
  categoryParentName?: string | null;
  /** Exports anteriores: la categoría era texto libre; se resuelve por nombre */
  category?: string | null;
  isActive: boolean;
  accountName: string;
  createdAt: string;
};

export type ExportCategory = {
  id: string;
  name: string;
  parentName: string | null;
  // "BOTH" solo aparece en exports anteriores a quitar ese tipo; al importar
  // se convierte en "EXPENSE" (ver importKind)
  kind: "INCOME" | "EXPENSE" | "BOTH" | "INTERNAL";
  color: string | null;
  icon: string | null;
};

/** Archivo de un adjunto a incluir en el zip: su ruta y dónde está guardado */
export type BackupFile = { path: string; storageKey: string };

/**
 * Exporta todos los datos de un usuario, junto con la lista de adjuntos a
 * meter en el zip. Usa los nombres como referencia en lugar de IDs para que
 * el import sea resiliente a cambios de schema.
 */
export async function exportUserData(
  userId: string
): Promise<{ json: ExportData; files: BackupFile[] }> {
  // Sin clave no se pueden descifrar: el respaldo sale sin adjuntos
  const withAttachments = getAttachmentsKey() !== null;
  const files: BackupFile[] = [];
  const [accounts, transactions, subscriptions, categories] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId },
      include: {
        categoryRef: { include: { parent: { select: { name: true } } } },
        account: { select: { name: true } },
        transferAccount: { select: { name: true } },
        subscription: { select: { name: true } },
        attachments: withAttachments
          ? {
              select: { id: true, originalName: true, mimeType: true, storageKey: true },
              orderBy: { createdAt: "asc" },
            }
          : false,
      },
      orderBy: { date: "asc" },
    }),
    prisma.subscription.findMany({
      where: { userId },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: { userId },
      include: { parent: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const json: ExportData = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    scope: "user",
    data: {
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: Number(a.balance),
        currency: a.currency,
        includeInBalance: a.includeInBalance,
        creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
        cutoffDay: a.cutoffDay,
        paymentDay: a.paymentDay,
        createdAt: a.createdAt.toISOString(),
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        date: t.date.toISOString(),
        description: t.description,
        category: t.category,
        categoryName: t.categoryRef?.name ?? null,
        categoryParentName: t.categoryRef?.parent?.name ?? null,
        accountName: t.account.name,
        transferAccountName: t.transferAccount?.name ?? null,
        isMsi: t.isMsi,
        msiParentId: t.msiParentId,
        msiTotalAmount: t.msiTotalAmount ? Number(t.msiTotalAmount) : null,
        msiInstallments: t.msiInstallments,
        subscriptionName: t.subscription?.name ?? null,
        createdAt: t.createdAt.toISOString(),
        attachments: t.attachments?.length
          ? t.attachments.map((a) => {
              const file = attachmentPath(a.id, a.mimeType);
              files.push({ path: file, storageKey: a.storageKey });
              return { file, name: a.originalName, mimeType: a.mimeType };
            })
          : undefined,
      })),
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        name: s.name,
        amount: Number(s.amount),
        billingDay: s.billingDay,
        frequency: s.frequency,
        billingMonth: s.billingMonth,
        categoryName: s.category?.name ?? null,
        categoryParentName: s.category?.parent?.name ?? null,
        isActive: s.isActive,
        accountName: s.account.name,
        createdAt: s.createdAt.toISOString(),
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        parentName: c.parent?.name ?? null,
        kind: c.kind,
        color: c.color,
        icon: c.icon,
      })),
    },
  };
  return { json, files };
}

/** Quita del JSON los adjuntos cuyos archivos no se pudieron leer al exportar */
export function dropMissingAttachments(
  data: ExportData["data"],
  missing: Set<string>
) {
  if (missing.size === 0) return;
  for (const t of data.transactions) {
    if (!t.attachments) continue;
    t.attachments = t.attachments.filter((a) => !missing.has(a.file));
    if (t.attachments.length === 0) delete t.attachments;
  }
}

/**
 * Exporta todos los datos del sistema (solo admin).
 * Incluye TODOS los usuarios + sus datos, con un campo userOwnerEmail
 * en cada registro para poder reimportarlo al usuario correcto.
 */
export type GlobalExportData = {
  version: ExportVersion;
  exportedAt: string;
  scope: "global";
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: "USER" | "ADMIN";
    isActive: boolean;
    mustChangePassword: boolean;
    createdAt: string;
    data: ExportData["data"];
  }>;
};

export async function exportAllData(): Promise<{
  json: GlobalExportData;
  files: BackupFile[];
}> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  const files: BackupFile[] = [];
  const usersData = await Promise.all(
    users.map(async (u) => {
      const { json, files: userFiles } = await exportUserData(u.id);
      files.push(...userFiles);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt.toISOString(),
        data: json.data,
      };
    })
  );

  return {
    json: {
      version: CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      scope: "global",
      users: usersData,
    },
    files,
  };
}

/**
 * Resultado del análisis (preview) de un import.
 * Le dice al usuario qué se va a crear, qué se va a sobreescribir,
 * y qué se va a saltar (duplicados).
 */
export type ImportPreview = {
  totalAccounts: number;
  totalTransactions: number;
  totalSubscriptions: number;
  totalCategories: number;
  totalAttachments: number;
  /** Hay adjuntos en el respaldo pero falta ATTACHMENTS_KEY: no se importarán */
  attachmentsDisabled: boolean;
  duplicates: {
    accounts: string[]; // nombres de cuentas que ya existen
    subscriptions: string[];
    categories: { name: string; parentName: string | null }[];
  };
  errors: string[]; // problemas que impiden el import
};

export type ImportStrategy = "create" | "overwrite" | "skip";

/**
 * Analiza el JSON de un usuario y devuelve un preview antes de aplicar.
 */
export async function previewImport(
  userId: string,
  json: ExportData
): Promise<ImportPreview> {
  const preview = emptyPreview();
  if (!isSupportedVersion(json.version)) {
    preview.errors.push(`Versión no soportada: ${json.version}`);
    return preview;
  }
  addTotals(preview, json.data);
  await addDuplicates(preview, userId, json.data);
  setAttachmentsDisabled(preview);
  return preview;
}

function emptyPreview(): ImportPreview {
  return {
    totalAccounts: 0,
    totalTransactions: 0,
    totalSubscriptions: 0,
    totalCategories: 0,
    totalAttachments: 0,
    attachmentsDisabled: false,
    duplicates: { accounts: [], subscriptions: [], categories: [] },
    errors: [],
  };
}

function addTotals(preview: ImportPreview, data: ExportData["data"]) {
  preview.totalAccounts += data.accounts.length;
  preview.totalTransactions += data.transactions.length;
  preview.totalSubscriptions += data.subscriptions.length;
  preview.totalCategories += data.categories.length;
  for (const t of data.transactions) {
    preview.totalAttachments += t.attachments?.length ?? 0;
  }
}

function setAttachmentsDisabled(preview: ImportPreview) {
  preview.attachmentsDisabled =
    preview.totalAttachments > 0 && getAttachmentsKey() === null;
}

/** Detecta duplicados contra el estado actual del usuario destino */
async function addDuplicates(
  preview: ImportPreview,
  userId: string,
  data: ExportData["data"]
) {
  const [existingAccounts, existingSubs, existingCategories] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { name: true },
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: { name: true },
    }),
    prisma.category.findMany({
      where: { userId },
      include: { parent: { select: { name: true } } },
    }),
  ]);

  const existingAccountNames = new Set(existingAccounts.map((a) => a.name));
  const existingSubNames = new Set(existingSubs.map((s) => s.name));
  const existingCategoryKeys = new Set(
    existingCategories.map((c) => `${c.parent?.name ?? ""}|${c.name}`)
  );

  for (const acc of data.accounts) {
    if (existingAccountNames.has(acc.name)) {
      preview.duplicates.accounts.push(acc.name);
    }
  }
  for (const sub of data.subscriptions) {
    if (existingSubNames.has(sub.name)) {
      preview.duplicates.subscriptions.push(sub.name);
    }
  }
  for (const cat of data.categories) {
    const key = `${cat.parentName ?? ""}|${cat.name}`;
    if (existingCategoryKeys.has(key)) {
      preview.duplicates.categories.push({
        name: cat.name,
        parentName: cat.parentName,
      });
    }
  }
}

/**
 * Preview de un import global: cada usuario del backup se restaura en la
 * cuenta con su mismo email. Si no existe, se creará.
 */
export type GlobalImportPreview = ImportPreview & {
  users: Array<{
    email: string;
    name: string;
    exists: boolean;
    totalAccounts: number;
    totalTransactions: number;
  }>;
};

export async function previewGlobalImport(
  json: GlobalExportData
): Promise<GlobalImportPreview> {
  const preview: GlobalImportPreview = { ...emptyPreview(), users: [] };
  if (!isSupportedVersion(json.version)) {
    preview.errors.push(`Versión no soportada: ${json.version}`);
    return preview;
  }

  for (const u of json.users) {
    const email = u.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    addTotals(preview, u.data);
    // Un usuario nuevo empieza vacío: no puede haber duplicados
    if (existing) await addDuplicates(preview, existing.id, u.data);
    preview.users.push({
      email,
      name: u.name,
      exists: !!existing,
      totalAccounts: u.data.accounts.length,
      totalTransactions: u.data.transactions.length,
    });
  }
  setAttachmentsDisabled(preview);
  return preview;
}

/**
 * Aplica el import. Estrategia:
 * - "create": crea todo, aunque exista (puede fallar por unique constraints)
 * - "overwrite": si existe por nombre, lo reemplaza. Si no, crea.
 * - "skip": si existe por nombre, lo salta. Si no, crea.
 */
export async function applyImport(params: {
  userId: string;
  json: ExportData;
  strategy: ImportStrategy;
  /** Archivos del zip (vacío si el respaldo es un .json) */
  files?: Map<string, Uint8Array>;
}): Promise<ImportResult> {
  const { userId, json, strategy } = params;

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, attachments: 0 };

  // Validar versión
  if (!isSupportedVersion(json.version)) {
    throw new Error(`Versión no soportada: ${json.version}`);
  }

  const files = await prepareImportFiles(params.files, [json.data]);

  // Una sola transacción: cualquier error rollback completo
  await runImportTx(files, (tx, att) =>
    importDataTx(tx, userId, json.data, strategy, result, att)
  );

  return result;
}

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  /** Adjuntos importados (los que no se pudieron cuentan en skipped) */
  attachments: number;
};

/** Adjuntos del respaldo ya validados, por su ruta dentro del zip */
type ImportFiles = Map<string, { data: Buffer; mimeType: string }>;

/**
 * Valida los archivos del zip igual que una subida normal (tipo real,
 * tamaño, sin metadatos). Solo los que usa algún movimiento; los inválidos se
 * descartan. Se hace antes de la transacción porque procesar imágenes tarda.
 */
async function prepareImportFiles(
  raw: Map<string, Uint8Array> | undefined,
  datas: ExportData["data"][]
): Promise<ImportFiles> {
  const files: ImportFiles = new Map();
  if (!raw?.size || getAttachmentsKey() === null) return files;
  for (const data of datas) {
    for (const t of data.transactions) {
      for (const a of t.attachments ?? []) {
        const bytes = raw.get(a.file);
        if (!bytes || files.has(a.file)) continue;
        try {
          files.set(a.file, await processUpload(Buffer.from(bytes)));
        } catch {
          // Archivo inválido: el adjunto se salta al importar
        }
      }
    }
  }
  return files;
}

/** Estado de los adjuntos durante la transacción de un import */
type AttachmentImport = {
  files: ImportFiles;
  key: Buffer | null;
  /** Archivos guardados: se borran si la transacción falla */
  written: string[];
  /** Archivos de adjuntos reemplazados: se borran si la transacción se confirma */
  replaced: string[];
};

// Con adjuntos un import puede tardar bastante más que los 5 s por defecto
const IMPORT_TX_OPTIONS = { maxWait: 10_000, timeout: 10 * 60_000 };

/**
 * Ejecuta un import en una transacción. Los archivos no son parte de la base
 * de datos: si la transacción falla se borran los que se guardaron, y si se
 * confirma se borran los de los adjuntos reemplazados.
 */
async function runImportTx<T>(
  files: ImportFiles,
  fn: (tx: TxClient, att: AttachmentImport) => Promise<T>
): Promise<T> {
  const att: AttachmentImport = {
    files,
    key: getAttachmentsKey(),
    written: [],
    replaced: [],
  };
  let out: T;
  try {
    out = await prisma.$transaction((tx) => fn(tx, att), IMPORT_TX_OPTIONS);
  } catch (error) {
    await deleteStoredFiles(att.written);
    throw error;
  }
  await deleteStoredFiles(att.replaced);
  return out;
}

export type GlobalImportResult = ImportResult & {
  /** Usuarios que no existían: se crearon con una contraseña temporal */
  createdUsers: Array<{ email: string; tempPassword: string }>;
};

const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTempPassword(): string {
  return Array.from(
    { length: 16 },
    () => TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)]
  ).join("");
}

/**
 * Aplica un import global: los datos de cada usuario del backup van a la
 * cuenta con su mismo email. Si no existe se crea, con una contraseña
 * temporal que hay que cambiar al iniciar sesión (el backup no incluye
 * contraseñas). Los usuarios existentes conservan su nombre, rol y estado.
 * Cada usuario se importa en su propia transacción.
 */
export async function applyGlobalImport(params: {
  json: GlobalExportData;
  strategy: ImportStrategy;
  files?: Map<string, Uint8Array>;
}): Promise<GlobalImportResult> {
  const { json, strategy } = params;
  const result: GlobalImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    attachments: 0,
    createdUsers: [],
  };

  if (!isSupportedVersion(json.version)) {
    throw new Error(`Versión no soportada: ${json.version}`);
  }

  const files = await prepareImportFiles(
    params.files,
    json.users.map((u) => u.data)
  );

  for (const u of json.users) {
    const email = u.email.trim().toLowerCase();
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const created = await runImportTx(files, async (tx, att) => {
      let user = await tx.user.findUnique({ where: { email } });
      const isNew = !user;
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            name: u.name,
            role: u.role,
            isActive: u.isActive,
            passwordHash,
            mustChangePassword: true,
          },
        });
      }
      await importDataTx(tx, user.id, u.data, strategy, result, att);
      return isNew;
    });

    if (created) result.createdUsers.push({ email, tempPassword });
  }

  return result;
}

async function importDataTx(
  tx: TxClient,
  userId: string,
  data: ExportData["data"],
  strategy: ImportStrategy,
  result: ImportResult,
  att: AttachmentImport
) {
  // 1. Categorías (padres antes que hijos). Clave "padre|nombre": puede
  // haber subcategorías con el mismo nombre que una raíz u otra subcategoría.
  const categoryIdMap = new Map<string, string>();

  // Batch: traer TODAS las categorías existentes del usuario en una sola query
  const existingCategories = await tx.category.findMany({ where: { userId } });
  const existingCategoryKeys = new Set<string>();
  const existingCategoryByKey = new Map<string, string>();
  for (const c of existingCategories) {
    const key = `${c.parentId ?? "null"}|${c.name}`;
    existingCategoryKeys.add(key);
    existingCategoryByKey.set(key, c.id);
  }

  // Primero las raíces
  for (const cat of data.categories.filter((c) => !c.parentName)) {
    const id = await upsertCategoryTx(
      tx,
      userId,
      cat,
      null,
      strategy,
      result,
      existingCategoryKeys,
      existingCategoryByKey
    );
    if (id) categoryIdMap.set(categoryKey(cat.parentName, cat.name), id);
  }
  // Después las hijas
  const rootIcons = new Map(
    data.categories.filter((c) => !c.parentName).map((c) => [c.name, c.icon])
  );
  for (const cat of data.categories.filter((c) => c.parentName)) {
    const parentId = categoryIdMap.get(categoryKey(null, cat.parentName!));
    if (!parentId) {
      result.skipped++;
      continue;
    }
    const id = await upsertCategoryTx(
      tx,
      userId,
      { ...cat, icon: subcategoryIcon(cat, rootIcons.get(cat.parentName!)) },
      parentId,
      strategy,
      result,
      existingCategoryKeys,
      existingCategoryByKey
    );
    if (id) categoryIdMap.set(categoryKey(cat.parentName, cat.name), id);
  }
  // Las subcategorías usan el color de su principal (un respaldo viejo puede
  // traer otro)
  await tx.$executeRaw`
    UPDATE "Category" c SET "color" = p."color"
    FROM "Category" p
    WHERE c."parentId" = p."id" AND c."userId" = ${userId}
  `;

  // 2. Cuentas: batch lookup
  const accountIdMap = new Map<string, string>();
  const existingAccounts = await tx.account.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const existingAccountByName = new Map(existingAccounts.map((a) => [a.name, a.id]));

  for (const acc of data.accounts) {
    const id = await upsertAccountTx(
      tx,
      userId,
      acc,
      strategy,
      result,
      existingAccountByName
    );
    if (id) accountIdMap.set(acc.name, id);
  }

  // 3. Suscripciones
  const existingSubs = await tx.subscription.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const existingSubByName = new Map(existingSubs.map((s) => [s.name, s.id]));

  for (const sub of data.subscriptions) {
    const accountId = accountIdMap.get(sub.accountName);
    if (!accountId) {
      result.skipped++;
      continue;
    }
    await upsertSubscriptionTx(
      tx,
      userId,
      sub,
      accountId,
      resolveCategoryId(
        categoryIdMap,
        sub.categoryName !== undefined
          ? { categoryName: sub.categoryName, categoryParentName: sub.categoryParentName ?? null }
          : { categoryName: sub.category ?? null } // export anterior: solo nombre
      ),
      strategy,
      result,
      existingSubByName
    );
  }

  // 4. Transacciones (dependen de todo lo anterior)
  for (const txData of data.transactions) {
    const accountId = accountIdMap.get(txData.accountName);
    const transferAccountId =
      txData.transferAccountName != null
        ? accountIdMap.get(txData.transferAccountName) ?? null
        : null;
    if (
      !accountId ||
      (txData.transferAccountName && !transferAccountId)
    ) {
      result.skipped++;
      continue;
    }
    const saved = await upsertTransactionTx(
      tx,
      userId,
      txData,
      accountId,
      transferAccountId,
      categoryIdMap,
      strategy,
      result
    );
    if (saved && txData.attachments?.length) {
      await importAttachmentsTx(tx, userId, saved, txData.attachments, att, result);
    }
  }
}

/**
 * Adjuntos de un movimiento importado. En uno nuevo se agregan; en uno
 * sobrescrito reemplazan a los que tenía (si alguno del respaldo es válido).
 */
async function importAttachmentsTx(
  tx: TxClient,
  userId: string,
  saved: SavedTransaction,
  attachments: ExportAttachment[],
  att: AttachmentImport,
  result: ImportResult
) {
  const valid = att.key
    ? attachments
        .filter((a) => att.files.has(a.file))
        .slice(0, MAX_ATTACHMENTS_PER_TRANSACTION)
    : [];
  result.skipped += attachments.length - valid.length;
  if (!att.key || valid.length === 0) return;

  if (saved.status === "updated") {
    const old = await tx.attachment.findMany({
      where: { transactionId: saved.id },
      select: { storageKey: true },
    });
    await tx.attachment.deleteMany({ where: { transactionId: saved.id } });
    att.replaced.push(...old.map((a) => a.storageKey));
  }

  const storage = getStorage();
  for (const a of valid) {
    const file = att.files.get(a.file)!;
    const storageKey = newStorageKey(userId);
    att.written.push(storageKey);
    await storage.put(storageKey, encrypt(att.key, storageKey, file.data));
    await tx.attachment.create({
      data: {
        userId,
        transactionId: saved.id,
        originalName: sanitizeName(a.name, file.mimeType),
        mimeType: file.mimeType,
        size: file.data.length,
        storageKey,
      },
    });
    result.attachments++;
  }
}

function importKind(kind: ExportCategory["kind"]) {
  return kind === "BOTH" ? "EXPENSE" : kind;
}

function categoryKey(parentName: string | null, name: string): string {
  return `${parentName ?? ""}|${name}`;
}

function resolveCategoryId(
  categoryIdMap: Map<string, string>,
  t: Pick<ExportTransaction, "categoryName" | "categoryParentName">
): string | null {
  if (!t.categoryName) return null;
  if (t.categoryParentName !== undefined) {
    return categoryIdMap.get(categoryKey(t.categoryParentName, t.categoryName)) ?? null;
  }
  // Export anterior sin padre: la raíz con ese nombre, o la primera
  // subcategoría que coincida
  const root = categoryIdMap.get(categoryKey(null, t.categoryName));
  if (root) return root;
  for (const [key, id] of categoryIdMap) {
    if (key.endsWith(`|${t.categoryName}`)) return id;
  }
  return null;
}

// Versiones Tx (reciben el cliente de transacción y mapas pre-cargados)
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Icono de una subcategoría importada. Los respaldos anteriores a los iconos
 * de Tabler guardaban en cada subcategoría el icono de su principal: en ese
 * caso (o sin icono) se usa el predeterminado si es una de fábrica, y si no,
 * ninguno (se muestra el de la principal).
 */
function subcategoryIcon(
  cat: ExportCategory,
  parentIcon: string | null | undefined
): string | null {
  const icon = normalizeCategoryIcon(cat.icon);
  if (icon && icon !== normalizeCategoryIcon(parentIcon)) return icon;
  return defaultSubcategoryIcon(cat.parentName!, cat.name);
}

async function upsertCategoryTx(
  tx: TxClient,
  userId: string,
  cat: ExportCategory,
  parentId: string | null,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number },
  existingKeys: Set<string>,
  existingByKey: Map<string, string> // key → id (pre-cargado)
): Promise<string | null> {
  const key = `${parentId ?? "null"}|${cat.name}`;

  // Si la categoría ya existía, usar el id pre-cargado (sin query)
  if (existingKeys.has(key)) {
    const existingId = existingByKey.get(key)!;
    if (strategy === "skip") {
      result.skipped++;
      return existingId;
    }
    if (strategy === "overwrite") {
      await tx.category.update({
        where: { id: existingId },
        data: {
          kind: importKind(cat.kind),
          color: cat.color,
          icon: normalizeCategoryIcon(cat.icon),
        },
      });
      result.updated++;
      return existingId;
    }
    result.skipped++;
    return existingId;
  }

  // No existe: crear
  const created = await tx.category.create({
    data: {
      userId,
      name: cat.name,
      parentId,
      kind: importKind(cat.kind),
      color: cat.color,
      icon: normalizeCategoryIcon(cat.icon),
    },
  });
  existingKeys.add(key);
  existingByKey.set(key, created.id);
  result.created++;
  return created.id;
}

async function upsertAccountTx(
  tx: TxClient,
  userId: string,
  acc: ExportAccount,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number },
  existingByName: Map<string, string>
): Promise<string | null> {
  const existingId = existingByName.get(acc.name);

  if (existingId) {
    if (strategy === "skip") {
      result.skipped++;
      return existingId;
    }
    if (strategy === "overwrite") {
      await tx.account.update({
        where: { id: existingId },
        data: {
          type: acc.type,
          balance: acc.balance,
          currency: acc.currency,
          includeInBalance: acc.includeInBalance,
          creditLimit: acc.creditLimit,
          cutoffDay: acc.cutoffDay,
          paymentDay: acc.paymentDay,
        },
      });
      result.updated++;
      return existingId;
    }
    result.skipped++;
    return existingId;
  }

  const created = await tx.account.create({
    data: {
      userId,
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      currency: acc.currency,
      includeInBalance: acc.includeInBalance,
      creditLimit: acc.creditLimit,
      cutoffDay: acc.cutoffDay,
      paymentDay: acc.paymentDay,
    },
  });
  existingByName.set(acc.name, created.id);
  result.created++;
  return created.id;
}

async function upsertSubscriptionTx(
  tx: TxClient,
  userId: string,
  sub: ExportSubscription,
  accountId: string,
  categoryId: string | null,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number },
  existingByName: Map<string, string>
): Promise<void> {
  const existingId = existingByName.get(sub.name);

  if (existingId) {
    if (strategy === "skip") {
      result.skipped++;
      return;
    }
    if (strategy === "overwrite") {
      await tx.subscription.update({
        where: { id: existingId },
        data: {
          amount: sub.amount,
          billingDay: sub.billingDay,
          ...importSchedule(sub),
          categoryId,
          isActive: sub.isActive,
          accountId,
          // El próximo cobro se recalcula desde hoy, sin cobrar fechas pasadas
          nextChargeAt: null,
        },
      });
      result.updated++;
      return;
    }
    result.skipped++;
    return;
  }

  await tx.subscription.create({
    data: {
      userId,
      name: sub.name,
      amount: sub.amount,
      billingDay: sub.billingDay,
      ...importSchedule(sub),
      categoryId,
      isActive: sub.isActive,
      accountId,
    },
  });
  existingByName.set(sub.name, "new");
  result.created++;
}

/** Frecuencia de una suscripción importada; las anuales sin mes, en enero */
function importSchedule(sub: ExportSubscription) {
  const frequency = sub.frequency === "YEARLY" ? "YEARLY" : "MONTHLY";
  return {
    frequency,
    billingMonth: frequency === "YEARLY" ? sub.billingMonth ?? 1 : null,
  } as const;
}

async function upsertTransactionTx(
  tx: TxClient,
  userId: string,
  t: ExportTransaction,
  accountId: string,
  transferAccountId: string | null,
  categoryIdMap: Map<string, string>,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number }
): Promise<SavedTransaction | null> {
  const categoryId = resolveCategoryId(categoryIdMap, t);

  const duplicate = await tx.transaction.findFirst({
    where: {
      userId,
      date: new Date(t.date),
      description: t.description,
      amount: t.amount,
      accountId,
    },
  });

  if (duplicate) {
    if (strategy === "skip") {
      result.skipped++;
      return null;
    }
    if (strategy === "overwrite") {
      await tx.transaction.update({
        where: { id: duplicate.id },
        data: {
          type: t.type,
          category: t.category,
          categoryId,
          transferAccountId,
          isMsi: t.isMsi,
          msiTotalAmount: t.msiTotalAmount,
          msiInstallments: t.msiInstallments,
        },
      });
      result.updated++;
      return { id: duplicate.id, status: "updated" };
    }
    result.skipped++;
    return null;
  }

  const created = await tx.transaction.create({
    data: {
      userId,
      type: t.type,
      amount: t.amount,
      date: new Date(t.date),
      description: t.description,
      category: t.category,
      categoryId,
      accountId,
      transferAccountId,
      isMsi: t.isMsi,
      msiTotalAmount: t.msiTotalAmount,
      msiInstallments: t.msiInstallments,
    },
    select: { id: true },
  });
  result.created++;
  return { id: created.id, status: "created" };
}

type SavedTransaction = { id: string; status: "created" | "updated" };
