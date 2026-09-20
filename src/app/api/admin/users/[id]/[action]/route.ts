import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const admin = await requireAdmin();
    if (params.id === admin.id) {
      return NextResponse.json(
        { error: "No puedes modificarte a ti mismo" },
        { status: 400 }
      );
    }

    if (params.action === "toggle-active") {
      const user = await prisma.user.findUnique({ where: { id: params.id } });
      if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await prisma.user.update({
        where: { id: params.id },
        data: { isActive: !user.isActive },
      });
      return NextResponse.json({ ok: true });
    }

    if (params.action === "toggle-role") {
      const user = await prisma.user.findUnique({ where: { id: params.id } });
      if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await prisma.user.update({
        where: { id: params.id },
        data: { role: user.role === "ADMIN" ? "USER" : "ADMIN" },
      });
      return NextResponse.json({ ok: true });
    }

    if (params.action === "delete") {
      await prisma.user.delete({ where: { id: params.id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error) {
    console.error("Admin user action error:", error);
    return NextResponse.json(
      { error: "Error en la operación" },
      { status: 500 }
    );
  }
}