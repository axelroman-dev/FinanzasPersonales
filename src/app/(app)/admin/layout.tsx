import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui/card";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="mb-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Panel de administración
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Administración</h1>
      </div>
      {children}
    </div>
  );
}