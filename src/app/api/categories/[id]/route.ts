import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isCategoryIcon } from "@/lib/category-icons";

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  kind: z.enum(["INCOME", "EXPENSE"]).optional(),
  color: z.string().nullable().optional(),
  icon: z.string().refine(isCategoryIcon, "Icono no válido").nullable().optional(),
});

async function findOwned(id: string, userId: string) {
  return prisma.category.findFirst({
    where: { id, userId },
    include: { children: true },
  });
}

/**
 * Cuenta movimientos vinculados a esta categoría o cualquiera de sus subcategorías.
 */
async function countUsage(
  categoryId: string,
  childIds: string[]
): Promise<number> {
  const ids = [categoryId, ...childIds];
  return prisma.transaction.count({
    where: { categoryId: { in: ids } },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const existing = await findOwned(params.id, user.id);
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (existing.kind === "INTERNAL") {
      return NextResponse.json(
        { error: "Las categorías internas no se pueden modificar" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    // Las subcategorías heredan tipo y color del padre: no se cambian por separado
    if (existing.parentId) {
      delete data.kind;
      delete data.color;
    }

    const category = await prisma.$transaction(async (tx) => {
      // Si cambian el tipo o el color de una principal, se propagan a los hijos
      if ((data.kind || data.color !== undefined) && existing.children.length > 0) {
        await tx.category.updateMany({
          where: { parentId: existing.id },
          data: {
            ...(data.kind && { kind: data.kind }),
            ...(data.color !== undefined && { color: data.color }),
          },
        });
      }
      return tx.category.update({ where: { id: params.id }, data });
    });
    return NextResponse.json(category);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const existing = await findOwned(params.id, user.id);
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (existing.kind === "INTERNAL") {
      return NextResponse.json(
        { error: "Las categorías internas no se pueden modificar" },
        { status: 400 }
      );
    }

    const childIds = existing.children.map((c) => c.id);
    const usageCount = await countUsage(params.id, childIds);

    // Safe delete: si hay uso, devolver error con detalles
    if (usageCount > 0) {
      const url = new URL(req.url);
      const force = url.searchParams.get("force") === "true";
      if (!force) {
        return NextResponse.json(
          {
            error: "Categoría en uso",
            usageCount,
            message: `Esta categoría tiene ${usageCount} movimiento(s) vinculado(s). Usa ?force=true para desvincular y eliminar, o primero oculta la categoría.`,
          },
          { status: 409 }
        );
      }
      // Forzar: desvincular movimientos primero
      const ids = [params.id, ...childIds];
      await prisma.transaction.updateMany({
        where: { categoryId: { in: ids } },
        data: { categoryId: null },
      });
    }

    // Borrar la categoría (cascade borra subcategorías)
    await prisma.category.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, unlinked: usageCount });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}