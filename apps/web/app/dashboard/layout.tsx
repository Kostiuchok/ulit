import { auth } from "../../auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#d9d9d9]">
        <div className="h-8 flex items-center justify-between px-8">
          <Link href="/dashboard/books" className="flex items-center gap-1">
            <img src="/figma/logo-group.svg" alt="" className="h-[18px] w-[18px]" />
            <span className="text-xs font-black tracking-tight text-black">ULIT</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="relative flex items-center">
              <img src="/figma/alert.svg" alt="Сповіщення" className="h-4 w-4" />
              <span className="absolute -top-1.5 -right-2.5 rounded-sm bg-[#ff5900] px-1 py-px text-[7px] font-black leading-none text-white">
                99+
              </span>
            </div>
            <Link href="/dashboard/settings" className="flex items-center gap-1.5 text-xs text-black">
              <img src="/figma/account.svg" alt="" className="h-4 w-4" />
              ПРОФІЛЬ
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
