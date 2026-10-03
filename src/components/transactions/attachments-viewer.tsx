"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, FileText, Loader2, Paperclip } from "lucide-react";
import type { AttachmentInfo } from "@/lib/attachment-rules";

/** Clip con la cantidad de adjuntos; abre un visor con las fotos y los PDF */
export function AttachmentsViewer({
  transactionId,
  description,
  count,
}: {
  transactionId: string;
  description: string;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentInfo[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setAttachments(null);
    fetch(`/api/transactions/${transactionId}/attachments`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setAttachments);
  }, [open, transactionId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label={`Ver ${count} recibo(s) de ${description}`}
        >
          <Paperclip className="h-3 w-3" />
          {count}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recibos · {description}</DialogTitle>
        </DialogHeader>
        {!attachments ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este movimiento no tiene recibos.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {attachments.map((a) => {
              const url = `/api/attachments/${a.id}`;
              return (
                <div key={a.id} className="rounded-md border overflow-hidden">
                  {a.mimeType.startsWith("image/") ? (
                    <a href={url} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={a.originalName} className="w-full max-h-80 object-contain bg-muted/30" />
                    </a>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener"
                      className="flex h-32 flex-col items-center justify-center gap-2 bg-muted/30 text-sm hover:text-foreground text-muted-foreground"
                    >
                      <FileText className="h-8 w-8" />
                      Abrir PDF
                    </a>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                    <span className="truncate" title={a.originalName}>
                      {a.originalName}
                    </span>
                    <a
                      href={`${url}?download=1`}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Descargar ${a.originalName}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
