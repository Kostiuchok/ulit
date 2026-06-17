import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { CookieBanner } from "../components/legal/CookieBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knyha — Платформа самовидавництва",
  description: "Публікуйте книги, отримуйте ISBN, продавайте у власному магазині та на Amazon.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="antialiased">
        <SessionProvider>
          {children}
          <CookieBanner />
        </SessionProvider>
      </body>
    </html>
  );
}
