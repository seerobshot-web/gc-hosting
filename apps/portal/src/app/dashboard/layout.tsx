import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/Sidebar";
import { can, getSession } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        orgName={session.org?.name ?? null}
        userName={session.name ?? session.email}
        userEmail={session.email}
        showOps={can(session, "member:manage")}
        supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? null}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
