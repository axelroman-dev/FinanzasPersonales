"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  ArrowLeftRight,
  FolderTree,
  PieChart,
  Shield,
  LogOut,
  UserPlus,
  Settings,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn, SIDEBAR_COOKIE } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

/**
 * Devuelve las iniciales del nombre (máximo 2 letras)
 */
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SidebarProps = {
  user: {
    name: string;
    email: string;
    role: "USER" | "ADMIN";
  };
};

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Cuentas", icon: Wallet },
  { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/subscriptions", label: "Suscripciones", icon: Receipt },
  { href: "/categories", label: "Categorías", icon: FolderTree },
  { href: "/reports", label: "Reportes", icon: PieChart },
];

const adminItems = [
  { href: "/admin", label: "Panel admin", icon: Shield, exact: true },
  { href: "/admin/users", label: "Usuarios", icon: UserPlus },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

/**
 * Envuelve un elemento con tooltip a la derecha solo si el sidebar está colapsado
 */
function WithTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <WithTooltip collapsed={collapsed} label={label}>
      <Link
        href={href}
        aria-label={collapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && label}
      </Link>
    </WithTooltip>
  );
}

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="Finanzas">
      <div className="h-8 w-8 shrink-0 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
        <Wallet className="h-4 w-4" />
      </div>
      {!collapsed && <span className="text-lg">Finanzas</span>}
    </Link>
  );
}

/**
 * Navegación + bloque de usuario, compartido entre el sidebar de escritorio
 * y el drawer móvil.
 */
function SidebarContent({
  user,
  pathname,
  onSignOut,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps & {
  pathname: string;
  onSignOut: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <nav className={cn("flex-1 overflow-y-auto p-4 space-y-6", collapsed && "px-2")}>
        {/* Sección principal */}
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              collapsed={collapsed}
              active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
            />
          ))}
        </div>

        {/* Sección admin (separada con padding) */}
        {isAdmin && (
          <div className="space-y-1 pt-2">
            {collapsed ? (
              <div className="mx-2 border-t" />
            ) : (
              <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </div>
            )}
            {adminItems.map(({ exact, ...item }) => (
              <NavLink
                key={item.href}
                {...item}
                collapsed={collapsed}
                active={exact ? pathname === item.href : pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}
      </nav>

      <div className={cn("border-t p-3 space-y-3", collapsed && "px-2")}>
        {/* Bloque del usuario (prominente) */}
        <WithTooltip collapsed={collapsed} label={user.name}>
          <Link
            href="/profile"
            aria-label={collapsed ? "Perfil" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md p-2 transition-colors",
              collapsed && "justify-center",
              pathname === "/profile"
                ? "bg-secondary"
                : "hover:bg-secondary/50"
            )}
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
              {getInitials(user.name)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            )}
          </Link>
        </WithTooltip>

        {/* Acciones (separadas del bloque de usuario) */}
        <div className="space-y-1">
          {onToggleCollapsed && (
            <WithTooltip collapsed={collapsed} label="Expandir menú">
              <button
                onClick={onToggleCollapsed}
                aria-label={collapsed ? "Expandir menú" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4 shrink-0" />
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4 shrink-0" />
                    Colapsar menú
                  </>
                )}
              </button>
            </WithTooltip>
          )}
          <WithTooltip collapsed={collapsed} label="Cerrar sesión">
            <button
              onClick={onSignOut}
              aria-label={collapsed ? "Cerrar sesión" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-destructive",
                collapsed && "justify-center px-0"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && "Cerrar sesión"}
            </button>
          </WithTooltip>
        </div>
      </div>
    </>
  );
}

export function Sidebar({
  user,
  defaultCollapsed = false,
}: SidebarProps & { defaultCollapsed?: boolean }) {
  const pathname = usePathname();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Cerrar el drawer móvil al navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function openSignOut() {
    setMobileOpen(false);
    setSignOutOpen(true);
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Barra superior móvil */}
      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Logo />
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Drawer móvil */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-background shadow-lg md:hidden duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
            <DialogPrimitive.Title className="sr-only">Menú de navegación</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Secciones de la aplicación
            </DialogPrimitive.Description>
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Logo />
              <DialogPrimitive.Close
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <SidebarContent user={user} pathname={pathname} onSignOut={openSignOut} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Sidebar de escritorio */}
      <aside
        className={cn(
          "hidden md:flex h-screen shrink-0 flex-col border-r bg-card/50 sticky top-0 transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b",
            collapsed ? "justify-center px-2" : "px-6"
          )}
        >
          <Logo collapsed={collapsed} />
        </div>
        <SidebarContent
          user={user}
          pathname={pathname}
          onSignOut={openSignOut}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {/* Dialog de confirmación */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Tendrás que volver a iniciar sesión para acceder a tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Sí, cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
