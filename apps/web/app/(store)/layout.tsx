import Link from "next/link";
import type { Metadata } from "next";
import { CartIcon } from "../../components/store/CartIcon";
import { Button } from "../../components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "../../components/ui/navigation-menu";
import { Toaster } from "../../components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "ULIT — Книжковий магазин",
    template: "%s | ULIT",
  },
  description: "Книги від українських авторів — електронні та друковані формати. Читайте та підтримуйте українське письменство.",
  openGraph: {
    siteName: "ULIT",
    locale: "uk_UA",
    type: "website",
  },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
            📚 <span>ULIT</span>
          </Link>

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/books">Каталог</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Е-книги</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[180px] gap-1 p-2">
                    {[
                      { href: "/books?format=EPUB", label: "EPUB" },
                      { href: "/books?format=FB2", label: "FB2" },
                      { href: "/books?format=MOBI", label: "MOBI" },
                    ].map((item) => (
                      <li key={item.href}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={item.href}
                            className="block select-none rounded-md p-2 text-sm leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          >
                            {item.label}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Друковані</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[220px] gap-1 p-2">
                    {[
                      { href: "/books?format=PRINT", label: "Усі друковані" },
                      { href: "/books?format=PRINT_HARDCOVER", label: "Тверда обкладинка" },
                      { href: "/books?format=PRINT_SOFTCOVER", label: "М'яка обкладинка" },
                    ].map((item) => (
                      <li key={item.href}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={item.href}
                            className="block select-none rounded-md p-2 text-sm leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          >
                            {item.label}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="hidden rounded-full text-xs font-medium text-gray-700 sm:inline-flex">
              <Link href="/dashboard/books">Кабінет автора</Link>
            </Button>
            <Link
              href="/books"
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              aria-label="Каталог"
            >
              🔍
            </Link>
            <CartIcon />
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t bg-white py-8 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} ULIT — платформа для українських авторів</p>
        <div className="mt-2 flex justify-center gap-6">
          <Link href="/terms" className="hover:text-gray-700">Умови використання</Link>
          <Link href="/privacy" className="hover:text-gray-700">Конфіденційність</Link>
          <Link href="/author-agreement" className="hover:text-gray-700">Договір автора</Link>
        </div>
      </footer>
      <Toaster position="top-right" richColors />
    </div>
  );
}
