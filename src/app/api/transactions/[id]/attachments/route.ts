import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ATTACHMENT_SELECT, AttachmentError, saveAttachments } from "@/lib/attachments";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-rules";

/** Adjuntos de un movimiento del usuario */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const attachments = await prisma.attachment.findMany({
    where: { transactionId: params.id, userId: user.id },
    select: ATTACHMENT_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(attachments);
}

/** Sube uno o varios archivos (multipart, campo "files") */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  // Fuera del try: requireUser() redirige lanzando, y el catch lo taparía
  const user = await requireUser();
  try {

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Envía los archivos como multipart/form-data" }, { status: 400 });
    }
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }
    // Rechazar por tamaño antes de leer el archivo en memoria
    if (files.some((f) => f.size > MAX_ATTACHMENT_BYTES)) {
      return NextResponse.json({ error: "Un archivo pasa de 10 MB" }, { status: 413 });
    }

    const saved = await saveAttachments({
      userId: user.id,
      transactionId: params.id,
      files: await Promise.all(
        files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))
      ),
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Upload attachment error:", error);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
