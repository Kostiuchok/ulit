import { auth } from "../../auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { Toaster } from "../../components/ui/sonner";
import { CreateBookProvider } from "../../components/books/CreateBookProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <CreateBookProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <DashboardHeader user={session.user!} />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <Toaster position="top-right" richColors />
      </div>
    </CreateBookProvider>
  );
}
