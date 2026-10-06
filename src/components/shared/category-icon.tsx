import { IconCategory } from "@tabler/icons-react";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

const FALLBACK_COLOR = "#71717a";

/**
 * Icono de una categoría dentro de un círculo con su color. Si el nombre no
 * existe (sin icono, o uno viejo de un respaldo) se usa el genérico.
 */
export function CategoryIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || IconCategory;
  const c = color ?? FALLBACK_COLOR;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" && "h-5 w-5",
        size === "md" && "h-8 w-8",
        size === "lg" && "h-10 w-10",
        className
      )}
      style={{ backgroundColor: `${c}26`, color: c }}
    >
      <Icon
        className={cn(
          size === "sm" && "h-3 w-3",
          size === "md" && "h-4 w-4",
          size === "lg" && "h-5 w-5"
        )}
        stroke={1.75}
      />
    </span>
  );
}
