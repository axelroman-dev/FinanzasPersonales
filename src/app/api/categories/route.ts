import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCategoryTree } from "@/lib/categories";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  parentId: z.string().nullable().optional(),
  kind: z.enum(["INCOME", "EXPENSE", "BOTH"]).default("BOTH"),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const tree = await getCategoryTree(user.id);
    return NextResponse.json(tree);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Si tiene parentId, validar que pertenece al usuario y que es raíz
    if (data.parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: data.parentId, userId: user.id },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Categoría padre no encontrada" },
          { status: 404 }
        );
      }
      if (parent.kind === "INTERNAL") {
        return NextResponse.json(
          { error: "Las categorías internas no se pueden modificar" },
          { status: 400 }
        );
      }
      if (parent.parentId) {
        return NextResponse.json(
          { error: "No se permiten subcategorías de subcategorías" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.category.create({
      data: {
        userId: user.id,
        name: data.name,
        parentId: data.parentId ?? null,
        kind: data.kind,
        color: data.color ?? null,
        icon: data.icon ?? null,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre" },
        { status: 409 }
      );
    }
    console.error("Create category error:", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}