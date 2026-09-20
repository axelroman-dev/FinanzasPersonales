import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const getRegistrationConfig = unstable_cache(
  async () => {
    const config = await prisma.appConfig.findUnique({
      where: { id: "singleton" },
    });
    return config?.allowRegistration ?? true;
  },
  ["registration-config"],
  { revalidate: 60, tags: ["registration-config"] }
);

export async function setRegistrationConfig(
  allow: boolean,
  adminId: string
): Promise<void> {
  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: { allowRegistration: allow, updatedById: adminId },
    create: {
      id: "singleton",
      allowRegistration: allow,
      updatedById: adminId,
    },
  });
  // Invalidar cache
  const { revalidateTag } = await import("next/cache");
  revalidateTag("registration-config");
}