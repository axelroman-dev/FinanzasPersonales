"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  /** Texto o lista de detalles bajo el título */
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción irreversible: botón rojo e icono de advertencia */
  destructive?: boolean;
  /**
   * Texto que hay que escribir para habilitar el botón (p. ej. el nombre de
   * lo que se borra), para acciones graves que no deben salir de un clic
   */
  confirmText?: string;
};

export type AlertOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
};

type Request = (ConfirmOptions & { kind: "confirm" }) | (AlertOptions & { kind: "alert" });

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * Reemplazo de window.confirm / window.alert con el Dialog de la app.
 * Uso: `if (!(await confirm({ title: "¿Eliminar?" }))) return;`
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const ask = useCallback((next: Request) => {
    // Si había una pregunta abierta, se toma como cancelada
    resolveRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setTyped("");
      setRequest(next);
      setOpen(true);
    });
  }, []);

  const value: ConfirmContextValue = {
    confirm: useCallback((o) => ask({ ...o, kind: "confirm" }), [ask]),
    alert: useCallback(async (o) => {
      await ask({ ...o, kind: "alert" });
    }, [ask]),
  };

  const destructive = request?.kind === "confirm" && request.destructive;
  const confirmText = request?.kind === "confirm" ? request.confirmText : undefined;
  // Sin distinguir mayúsculas ni espacios de más
  const typedOk =
    !confirmText || typed.trim().toLowerCase() === confirmText.trim().toLowerCase();
  const Icon = destructive ? AlertTriangle : Info;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
        {request && (
          <DialogContent className="max-w-md">
            <DialogHeader className="flex-row items-start gap-3 space-y-0 text-left">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  destructive
                    ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 pr-6">
                <DialogTitle className="leading-snug">{request.title}</DialogTitle>
                {request.description ? (
                  <DialogDescription asChild>
                    <div className="space-y-2">{request.description}</div>
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">{request.title}</DialogDescription>
                )}
              </div>
            </DialogHeader>
            {confirmText && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typedOk) settle(true);
                }}
              >
                <label htmlFor="confirm-text" className="text-sm text-muted-foreground">
                  Para confirmar, escribe{" "}
                  <span className="font-semibold text-foreground">{confirmText}</span>
                </label>
                <Input
                  id="confirm-text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </form>
            )}
            <DialogFooter>
              {request.kind === "confirm" && (
                <Button variant="outline" onClick={() => settle(false)}>
                  {request.cancelLabel ?? "Cancelar"}
                </Button>
              )}
              <Button
                variant={destructive ? "destructive" : "default"}
                onClick={() => settle(true)}
                disabled={!typedOk}
                autoFocus={!confirmText}
              >
                {request.confirmLabel ?? (request.kind === "alert" ? "Entendido" : "Confirmar")}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

function useConfirmContext() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>");
  return ctx;
}

/** Pregunta con Cancelar / Confirmar; resuelve true si el usuario acepta */
export function useConfirm() {
  return useConfirmContext().confirm;
}

/** Aviso con un solo botón; resuelve al cerrarlo */
export function useAlert() {
  return useConfirmContext().alert;
}
