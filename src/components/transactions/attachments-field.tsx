"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, FileText, Loader2, Paperclip, X } from "lucide-react";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TRANSACTION,
  type AttachmentInfo,
} from "@/lib/attachment-rules";
import { useConfirm } from "@/components/shared/confirm-dialog";

/**
 * Sección "Recibos" del formulario de movimiento. Los archivos nuevos quedan
 * pendientes y el formulario los sube al guardar (con uploadAttachments); los
 * que ya existen se pueden borrar en el momento.
 */
export function AttachmentsField({
  transactionId,
  pending,
  onPendingChange,
}: {
  /** Movimiento existente (al editar); al crear todavía no hay id */
  transactionId?: string;
  pending: File[];
  onPendingChange: (files: File[]) => void;
}) {
  const confirm = useConfirm();
  const [existing, setExisting] = useState<AttachmentInfo[]>([]);
  const [loading, setLoading] = useState(!!transactionId);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // «Tomar foto» solo abre la cámara en celulares y tablets; en la
  // computadora abría el explorador de archivos, igual que «Subir archivo»
  const [canUseCamera, setCanUseCamera] = useState(false);
  useEffect(() => {
    setCanUseCamera(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!transactionId) return;
    fetch(`/api/transactions/${transactionId}/attachments`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setExisting)
      .finally(() => setLoading(false));
  }, [transactionId]);

  function addFiles(list: FileList | null) {
    setError(null);
    if (!list) return;
    const files = Array.from(list);
    const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig.length > 0) {
      setError(`Pasa de 10 MB: ${tooBig.map((f) => f.name).join(", ")}`);
    }
    const next = [...pending, ...files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)];
    const room = MAX_ATTACHMENTS_PER_TRANSACTION - existing.length;
    if (next.length > room) {
      setError(`Un movimiento admite hasta ${MAX_ATTACHMENTS_PER_TRANSACTION} adjuntos`);
    }
    onPendingChange(next.slice(0, Math.max(room, 0)));
  }

  async function removeExisting(attachment: AttachmentInfo) {
    const ok = await confirm({
      title: "¿Eliminar este recibo?",
      description: `"${attachment.originalName}" se borrará del movimiento.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(attachment.id);
    const res = await fetch(`/api/attachments/${attachment.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setExisting((list) => list.filter((a) => a.id !== attachment.id));
    } else {
      setError("No se pudo eliminar el adjunto");
    }
  }

  const total = existing.length + pending.length;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        <Paperclip className="h-3 w-3" />
        Recibos (opcional)
      </Label>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando adjuntos…</p>
      ) : (
        total > 0 && (
          <div className="flex flex-wrap gap-2">
            {existing.map((a) => (
              <Thumb
                key={a.id}
                name={a.originalName}
                src={a.mimeType.startsWith("image/") ? `/api/attachments/${a.id}` : null}
                href={`/api/attachments/${a.id}`}
                busy={deletingId === a.id}
                onRemove={() => removeExisting(a)}
              />
            ))}
            {pending.map((f, i) => (
              <PendingThumb
                key={`${f.name}-${i}`}
                file={f}
                onRemove={() => onPendingChange(pending.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )
      )}

      <div className="flex gap-2">
        {canUseCamera && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cameraRef.current?.click()}
            disabled={total >= MAX_ATTACHMENTS_PER_TRANSACTION}
          >
            <Camera className="h-4 w-4" />
            Tomar foto
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={total >= MAX_ATTACHMENTS_PER_TRANSACTION}
        >
          <Paperclip className="h-4 w-4" />
          Subir archivo
        </Button>
        {/* capture abre la cámara del celular */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Fotos o PDF, hasta 10 MB. Las fotos se guardan sin ubicación ni datos
        del celular.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PendingThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <Thumb name={file.name} src={url} pending onRemove={onRemove} />;
}

function Thumb({
  name,
  src,
  href,
  pending,
  busy,
  onRemove,
}: {
  name: string;
  src: string | null;
  href?: string;
  pending?: boolean;
  busy?: boolean;
  onRemove: () => void;
}) {
  const content = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="h-full w-full object-cover" />
  ) : (
    <FileText className="h-6 w-6 text-muted-foreground" />
  );
  return (
    <div
      className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted/30 flex items-center justify-center"
      title={pending ? `${name} (se sube al guardar)` : name}
    >
      {href ? (
        <a href={href} target="_blank" rel="noopener" className="h-full w-full flex items-center justify-center">
          {content}
        </a>
      ) : (
        content
      )}
      {pending && (
        <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] text-center">
          Nuevo
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 hover:bg-destructive hover:text-destructive-foreground"
        aria-label={`Quitar ${name}`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </div>
  );
}

/** Sube los archivos pendientes de un movimiento; devuelve un error o null */
export async function uploadAttachments(
  transactionId: string,
  files: File[]
): Promise<string | null> {
  if (files.length === 0) return null;
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await fetch(`/api/transactions/${transactionId}/attachments`, {
    method: "POST",
    body: form,
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error || "No se pudieron subir los adjuntos";
}
