import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { seedDefaultCategories } from "@/lib/categories";
import { mailEnabled } from "@/lib/mail/config";
import { sendInvite } from "@/lib/mail/links";

/**
 * Sin `password`: invitación por correo (el usuario crea su contraseña desde
 * el enlace). Con `password`: contraseña temporal que debe cambiar al entrar,
 * para cuando no hay correo configurado o el admin lo prefiere.
 */
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
});

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { name, email, password, role } = parsed.data;
    if (!password && !mailEnabled()) {
      return NextResponse.json(
        { error: "Sin correo configurado hay que poner una contraseña temporal" },
        { status: 400 }
      );
    }

    // Verificar que no exista (sin distinguir mayúsculas)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        isActive: true,
        ...(password
          ? {
              passwordHash: await bcrypt.hash(password, 10),
              // Contraseña temporal: la DEBE cambiar en el primer login
              mustChangePassword: true,
            }
          : // Invitación: sin contraseña hasta que la cree desde el correo
            { passwordHash: null, mustChangePassword: false }),
      },
    });

    // Crear categorías predeterminadas para el nuevo usuario
    await seedDefaultCategories(user.id);

    // Si el correo falla, el usuario queda creado: se reenvía desde la lista
    const invite = password ? null : await sendInvite(user, admin.name);

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: role,
        },
        invited: !password,
        inviteSent: invite?.ok ?? false,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}