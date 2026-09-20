import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
        }}
      />
      <main className="flex-1 min-h-screen">{children}</main>
    </div>
  );
}