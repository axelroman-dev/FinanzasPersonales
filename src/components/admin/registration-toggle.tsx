"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function RegistrationToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function onChange(value: boolean) {
    setEnabled(value);
    startTransition(async () => {
      await fetch("/api/admin/settings/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow: value }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label className="text-base">Permitir nuevos registros</Label>
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "Cualquier visitante puede crear una cuenta"
            : "El registro está cerrado. Solo los admins pueden crear usuarios."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Switch checked={enabled} onCheckedChange={onChange} />
      </div>
    </div>
  );
}