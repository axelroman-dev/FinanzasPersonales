"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronRight,
  EyeOff,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryDialog } from "./category-dialog";

type CatNode = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  kind: "INCOME" | "EXPENSE" | "BOTH";
  parentId: string | null;
  usageCount: number;
  children: CatNode[];
};

export function CategoryRow({
  category,
  allowSubcategories,
  usageCount,
}: {
  category: CatNode;
  allowSubcategories: boolean;
  usageCount: number;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const hasChildren = category.children.length > 0;
  const isProtected = usageCount > 0;

  function toggleHide() {
    setHidden((v) => !v);
  }

  async function onDelete() {
    if (isProtected) return;

    // Primer intento (detección de uso)
    const probe = await fetch(`/api/categories/${category.id}`, {
      method: "DELETE",
    });

    if (probe.status === 409) {
      const data = await probe.json();
      const force = confirm(
        `"${category.name}" tiene ${data.usageCount ?? 0} movimiento(s) vinculado(s).\n\n` +
          `Si la eliminas con "force", esos movimientos quedarán SIN categoría.\n\n` +
          `¿Continuar?`
      );
      if (!force) return;
      startTransition(async () => {
        const res = await fetch(`/api/categories/${category.id}?force=true`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Error al eliminar");
          return;
        }
        router.refresh();
      });
      return;
    }

    if (!probe.ok) {
      alert("Error al eliminar");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-secondary/50",
          hidden && "opacity-50"
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          disabled={!hasChildren}
          className={cn(
            "h-5 w-5 flex items-center justify-center text-muted-foreground transition-transform",
            hasChildren && "hover:text-foreground cursor-pointer",
            !expanded && hasChildren && "-rotate-90"
          )}
        >
          {hasChildren ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="block h-1 w-1 rounded-full bg-muted-foreground/40" />
          )}
        </button>

        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: category.color ?? "#71717a" }}
        />

        <span className={cn("font-medium text-sm flex-1", hidden && "line-through")}>
          {category.name}
        </span>

        {hasChildren && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {category.children.length}
          </span>
        )}

        {usageCount > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums" title={`${usageCount} movimientos`}>
            · {usageCount}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-secondary"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoreHorizontal className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {allowSubcategories && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setAddSubOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Agregar subcategoría
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setEditOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleHide}>
              {hidden ? (
                <>
                  <Eye className="h-4 w-4" />
                  Mostrar
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4" />
                  Ocultar
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              disabled={isProtected}
              className="text-destructive focus:text-destructive data-[disabled]:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isProtected ? `En uso (${usageCount})` : "Eliminar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Diálogos controlados por estado — sin anidamiento en el dropdown */}
      {editOpen && (
        <CategoryDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          category={{
            id: category.id,
            name: category.name,
            kind: category.kind,
            color: category.color,
            icon: category.icon,
            parentId: category.parentId,
          }}
        />
      )}
      {addSubOpen && (
        <CategoryDialog
          mode="create"
          open={addSubOpen}
          onOpenChange={setAddSubOpen}
          parentId={category.id}
        />
      )}

      {expanded && hasChildren && (
        <div className="ml-7 pl-3 border-l space-y-1">
          {category.children.map((sub) => (
            <SubcategoryRow key={sub.id} sub={sub} usageCount={sub.usageCount} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubcategoryRow({
  sub,
  usageCount,
}: {
  sub: CatNode;
  usageCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const isProtected = usageCount > 0;

  async function onDelete() {
    if (isProtected) return;

    const probe = await fetch(`/api/categories/${sub.id}`, {
      method: "DELETE",
    });

    if (probe.status === 409) {
      const data = await probe.json();
      const force = confirm(
        `"${sub.name}" tiene ${data.usageCount ?? 0} movimiento(s) vinculado(s).\n\n` +
          `Si la eliminas con "force", esos movimientos quedarán SIN categoría.\n\n` +
          `¿Continuar?`
      );
      if (!force) return;
      startTransition(async () => {
        const res = await fetch(`/api/categories/${sub.id}?force=true`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Error al eliminar");
          return;
        }
        router.refresh();
      });
      return;
    }

    if (!probe.ok) {
      alert("Error al eliminar");
      return;
    }
    router.refresh();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-secondary/50",
        hidden && "opacity-50"
      )}
    >
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: sub.color ?? "#71717a" }}
      />
      <span className={cn("text-sm flex-1 text-muted-foreground", hidden && "line-through")}>
        {sub.name}
      </span>

      {usageCount > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums" title={`${usageCount} movimientos`}>
          · {usageCount}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-secondary"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MoreHorizontal className="h-3 w-3" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setHidden(!hidden)}>
            {hidden ? (
              <>
                <Eye className="h-4 w-4" />
                Mostrar
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                Ocultar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={onDelete}
            disabled={isProtected}
            className="text-destructive focus:text-destructive data-[disabled]:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isProtected ? `En uso (${usageCount})` : "Eliminar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen && (
        <CategoryDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          category={{
            id: sub.id,
            name: sub.name,
            kind: sub.kind,
            color: sub.color,
            icon: sub.icon,
            parentId: sub.parentId,
          }}
        />
      )}
    </div>
  );
}