import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knyha — Платформа самовидавництва",
  description: "Публікуйте книги, отримуйте ISBN, продавайте у власному магазині та на Amazon.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="antialiased">{children}</body>
    </html>
  );
}
