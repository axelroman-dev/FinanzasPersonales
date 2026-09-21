import { prisma } from "@/lib/db";

/**
 * Estructura del JSON de export/import.
 * Versionado: si en el futuro cambia el formato, podemos detectar
 * la versión del archivo y migrar/avisar al usuario.
 */
export type ExportVersion = "1.0";

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
  accountName: string; // nombre para resolver al importar
  transferAccountName: string | null;
  isMsi: boolean;
  msiParentId: string | null;
  msiTotalAmount: number | null;
  msiInstallments: number | null;
  subscriptionName: string | null;
  createdAt: string;
};

export type ExportSubscription = {
  id: string;
  name: string;
  amount: number;
  billingDay: number;
  category: string | null;
  isActive: boolean;
  accountName: string;
  createdAt: string;
};

export type ExportCategory = {
  id: string;
  name: string;
  parentName: string | null;
  kind: "INCOME" | "EXPENSE" | "BOTH";
  color: string | null;
  icon: string | null;
};

/**
 * Exporta todos los datos de un usuario.
 * Usa los nombres como referencia en lugar de IDs para que el import
 * sea resiliente a cambios de schema.
 */
export async function exportUserData(userId: string): Promise<ExportData> {
  const [accounts, transactions, subscriptions, categories] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId },
      include: {
        categoryRef: true,
        account: { select: { name: true } },
        transferAccount: { select: { name: true } },
        subscription: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.subscription.findMany({
      where: { userId },
      include: { account: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: { userId },
      include: { parent: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Construir mapa de categorías por nombre para resolver parentName
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  return {
    version: "1.0",
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
        accountName: t.account.name,
        transferAccountName: t.transferAccount?.name ?? null,
        isMsi: t.isMsi,
        msiParentId: t.msiParentId,
        msiTotalAmount: t.msiTotalAmount ? Number(t.msiTotalAmount) : null,
        msiInstallments: t.msiInstallments,
        subscriptionName: t.subscription?.name ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        name: s.name,
        amount: Number(s.amount),
        billingDay: s.billingDay,
        category: s.category,
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

export async function exportAllData(): Promise<GlobalExportData> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  const usersData = await Promise.all(
    users.map(async (u) => {
      const data = await exportUserData(u.id);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt.toISOString(),
        data: data.data,
      };
    })
  );

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    scope: "global",
    users: usersData,
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
  duplicates: {
    accounts: string[]; // nombres de cuentas que ya existen
    subscriptions: string[];
    categories: { name: string; parentName: string | null }[];
  };
  errors: string[]; // problemas que impiden el import
};

export type ImportStrategy = "create" | "overwrite" | "skip";

/**
 * Analiza el JSON y devuelve un preview antes de aplicar.
 */
export async function previewImport(
  userId: string,
  json: ExportData | GlobalExportData
): Promise<ImportPreview> {
  const preview: ImportPreview = {
    totalAccounts: 0,
    totalTransactions: 0,
    totalSubscriptions: 0,
    totalCategories: 0,
    duplicates: { accounts: [], subscriptions: [], categories: [] },
    errors: [],
  };

  // Validar versión
  if (json.version !== "1.0") {
    preview.errors.push(`Versión no soportada: ${json.version}`);
    return preview;
  }

  // Determinar los bloques de datos según el scope
  const dataBlocks: ExportData["data"][] =
    json.scope === "global"
      ? (json as GlobalExportData).users.map((u) => u.data)
      : [json.data];

  for (const data of dataBlocks) {
    preview.totalAccounts += data.accounts.length;
    preview.totalTransactions += data.transactions.length;
    preview.totalSubscriptions += data.subscriptions.length;
    preview.totalCategories += data.categories.length;
  }

  // Detectar duplicados contra el estado actual del usuario destino
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

  for (const data of dataBlocks) {
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
  json: ExportData | GlobalExportData;
  strategy: ImportStrategy;
}): Promise<{ created: number; updated: number; skipped: number }> {
  const { userId, json, strategy } = params;

  const result = { created: 0, updated: 0, skipped: 0 };

  // Validar versión
  if (json.version !== "1.0") {
    throw new Error(`Versión no soportada: ${json.version}`);
  }

  const dataBlocks: ExportData["data"][] =
    json.scope === "global"
      ? (json as GlobalExportData).users.map((u) => u.data)
      : [json.data];

  for (const data of dataBlocks) {
    await importOne(userId, data, strategy, result);
  }

  return result;
}

async function importOne(
  userId: string,
  data: ExportData["data"],
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number }
) {
  // Una sola transacción: cualquier error rollback completo
  await prisma.$transaction(async (tx) => {
    // 1. Categorías (padres antes que hijos)
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
      if (id) categoryIdMap.set(cat.name, id);
    }
    // Después las hijas
    for (const cat of data.categories.filter((c) => c.parentName)) {
      const parentId = categoryIdMap.get(cat.parentName!);
      if (!parentId) {
        result.skipped++;
        continue;
      }
      const id = await upsertCategoryTx(
        tx,
        userId,
        cat,
        parentId,
        strategy,
        result,
        existingCategoryKeys,
        existingCategoryByKey
      );
      if (id) categoryIdMap.set(cat.name, id);
    }

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
      await upsertTransactionTx(
        tx,
        userId,
        txData,
        accountId,
        transferAccountId,
        categoryIdMap,
        strategy,
        result
      );
    }
  });
}

// Versiones Tx (reciben el cliente de transacción y mapas pre-cargados)
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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
        data: { kind: cat.kind, color: cat.color, icon: cat.icon },
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
      kind: cat.kind,
      color: cat.color,
      icon: cat.icon,
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
          category: sub.category,
          isActive: sub.isActive,
          accountId,
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
      category: sub.category,
      isActive: sub.isActive,
      accountId,
    },
  });
  existingByName.set(sub.name, "new");
  result.created++;
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
): Promise<void> {
  const categoryId = t.categoryName
    ? categoryIdMap.get(t.categoryName) ?? null
    : null;

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
      return;
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
      return;
    }
    result.skipped++;
    return;
  }

  await tx.transaction.create({
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
  });
  result.created++;
}

async function upsertCategory(
  userId: string,
  cat: ExportCategory,
  parentId: string | null,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number }
): Promise<string | null> {
  const existing = await prisma.category.findFirst({
    where: {
      userId,
      name: cat.name,
      parentId,
    },
  });

  if (existing) {
    if (strategy === "skip") {
      result.skipped++;
      return existing.id;
    }
    if (strategy === "overwrite") {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          kind: cat.kind,
          color: cat.color,
          icon: cat.icon,
        },
      });
      result.updated++;
      return existing.id;
    }
    // create: fallará por unique constraint, saltamos
    result.skipped++;
    return existing.id;
  }

  const created = await prisma.category.create({
    data: {
      userId,
      name: cat.name,
      parentId,
      kind: cat.kind,
      color: cat.color,
      icon: cat.icon,
    },
  });
  result.created++;
  return created.id;
}

async function upsertAccount(
  userId: string,
  acc: ExportAccount,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number }
): Promise<string | null> {
  const existing = await prisma.account.findFirst({
    where: { userId, name: acc.name },
  });

  if (existing) {
    if (strategy === "skip") {
      result.skipped++;
      return existing.id;
    }
    if (strategy === "overwrite") {
      await prisma.account.update({
        where: { id: existing.id },
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
      return existing.id;
    }
    result.skipped++;
    return existing.id;
  }

  const created = await prisma.account.create({
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
  result.created++;
  return created.id;
}

async function upsertSubscription(
  userId: string,
  sub: ExportSubscription,
  accountId: string,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number }
): Promise<void> {
  const existing = await prisma.subscription.findFirst({
    where: { userId, name: sub.name },
  });

  if (existing) {
    if (strategy === "skip") {
      result.skipped++;
      return;
    }
    if (strategy === "overwrite") {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          amount: sub.amount,
          billingDay: sub.billingDay,
          category: sub.category,
          isActive: sub.isActive,
          accountId,
        },
      });
      result.updated++;
      return;
    }
    result.skipped++;
    return;
  }

  await prisma.subscription.create({
    data: {
      userId,
      name: sub.name,
      amount: sub.amount,
      billingDay: sub.billingDay,
      category: sub.category,
      isActive: sub.isActive,
      accountId,
    },
  });
  result.created++;
}

async function upsertTransaction(
  userId: string,
  tx: ExportTransaction,
  accountId: string,
  transferAccountId: string | null,
  categoryIdMap: Map<string, string>,
  strategy: ImportStrategy,
  result: { created: number; updated: number; skipped: number }
): Promise<void> {
  // Las transacciones NO se sobreescriben (cada una es única por fecha+descripción+monto)
  // Siempre se crean nuevas si no hay duplicado obvio
  const categoryId = tx.categoryName
    ? categoryIdMap.get(tx.categoryName) ?? null
    : null;

  // Detectar duplicado obvio: misma fecha + descripción + monto + cuenta
  const duplicate = await prisma.transaction.findFirst({
    where: {
      userId,
      date: new Date(tx.date),
      description: tx.description,
      amount: tx.amount,
      accountId,
    },
  });

  if (duplicate) {
    if (strategy === "skip") {
      result.skipped++;
      return;
    }
    // Si strategy es "overwrite", actualizamos algunos campos
    if (strategy === "overwrite") {
      await prisma.transaction.update({
        where: { id: duplicate.id },
        data: {
          type: tx.type,
          category: tx.category,
          categoryId,
          transferAccountId,
          isMsi: tx.isMsi,
          msiTotalAmount: tx.msiTotalAmount,
          msiInstallments: tx.msiInstallments,
        },
      });
      result.updated++;
      return;
    }
    // create: saltar duplicado obvio
    result.skipped++;
    return;
  }

  await prisma.transaction.create({
    data: {
      userId,
      type: tx.type,
      amount: tx.amount,
      date: new Date(tx.date),
      description: tx.description,
      category: tx.category,
      categoryId,
      accountId,
      transferAccountId,
      isMsi: tx.isMsi,
      msiTotalAmount: tx.msiTotalAmount,
      msiInstallments: tx.msiInstallments,
    },
  });
  result.created++;
}