import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { AttachmentError, deleteAttachment, readAttachment } from "@/lib/attachments";

/**
 * Descarga un adjunto del usuario, descifrado. Los headers impiden que el
 * navegador lo interprete como otra cosa o que un PDF ejecute código en el
 * origen de la app. ?download=1 lo baja en lugar de mostrarlo.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  // Fuera del try: requireUser() redirige lanzando, y el catch lo taparía
  const user = await requireUser();
  try {
    const { attachment, data } = await readAttachment(user.id, params.id);
    const download = new URL(req.url).searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, no-store",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Read attachment error:", error);
    return NextResponse.json({ error: "Error al leer el adjunto" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  // Fuera del try: requireUser() redirige lanzando, y el catch lo taparía
  const user = await requireUser();
  try {
    await deleteAttachment(user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Delete attachment error:", error);
    return NextResponse.json({ error: "Error al eliminar el adjunto" }, { status: 500 });
  }
}
