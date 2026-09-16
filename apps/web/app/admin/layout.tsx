import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AdminSidebar } from "../../components/admin/AdminSidebar";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../components/ui/sidebar";
import { Toaster } from "../../components/ui/sonner";

export const metadata = { title: { template: "%s | ULIT Admin", default: "Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/dashboard");
  }

  return (
    <SidebarProvider className="bg-gray-50">
      <AdminSidebar />
      <SidebarInset className="bg-gray-50">
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>👤 {session.user?.name}</span>
            <Badge className="rounded-full border-transparent bg-red-100 font-medium text-red-700 hover:bg-red-100">
              ADMIN
            </Badge>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
      <Toaster position="top-right" richColors />
    </SidebarProvider>
  );
}
