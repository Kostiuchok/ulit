import { auth } from "../../auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FontSizeControl } from "../../components/dashboard/FontSizeControl";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#d9d9d9]">
        <div className="h-8 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/books" className="flex items-center gap-1">
              <img src="/figma/logo-group.svg" alt="" className="h-[1.125rem] w-[1.125rem]" />
              <span className="text-xs font-black tracking-tight text-black">ULIT</span>
            </Link>
            <Link href="/" className="text-xs text-black/70 hover:text-black">
              На сайт
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <FontSizeControl />
            <div className="relative flex items-center">
              <img src="/figma/alert.svg" alt="Сповіщення" className="h-[1rem] w-[1rem]" />
              <span className="absolute -top-2.5 -right-3.5 rounded-sm bg-[#ff5900] px-1.5 py-0.5 text-[0.75rem] font-black leading-none text-white">
                99+
              </span>
            </div>
            <Link href="/dashboard/settings" className="flex items-center gap-1.5 text-xs text-black">
              <img src="/figma/account.svg" alt="" className="h-[1rem] w-[1rem]" />
              ПРОФІЛЬ
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
