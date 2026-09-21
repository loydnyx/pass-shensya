import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import VaultApp from "@/components/VaultApp";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { displayName: true, email: true },
  });
  if (!user) redirect("/login");

  return <VaultApp displayName={user.displayName} email={user.email} />;
}
