import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";
import { SIDEBAR_COOKIE } from "@/lib/utils";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WELCOME_PATH } from "@/lib/onboarding";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Cuenta nueva: primero elige sus monedas
  if (!user.onboardedAt) redirect(WELCOME_PATH);
  const sidebarCollapsed = cookies().get(SIDEBAR_COOKIE)?.value === "1";
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
        }}
        defaultCollapsed={sidebarCollapsed}
      />
      <main className="flex-1 min-w-0 md:min-h-screen">{children}</main>
    </div>
  );
}