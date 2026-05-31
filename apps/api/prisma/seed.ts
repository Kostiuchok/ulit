import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("admin123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@knyha.ua" },
    update: {},
    create: {
      email: "admin@knyha.ua",
      passwordHash: adminHash,
      name: "Адмін Knyha",
      slug: "admin-knyha",
      role: "ADMIN",
    },
  });

  const authorHash = await bcrypt.hash("author123456", 12);
  const author = await prisma.user.upsert({
    where: { email: "author@knyha.ua" },
    update: {},
    create: {
      email: "author@knyha.ua",
      passwordHash: authorHash,
      name: "Тестовий Автор",
      slug: "testovyi-avtor",
      role: "AUTHOR",
      bio: "Тестовий автор для демонстрації платформи Knyha.",
    },
  });

  const book1 = await prisma.book.upsert({
    where: { slug: "kobzar-demo" },
    update: {},
    create: {
      slug: "kobzar-demo",
      title: "Кобзар (демо)",
      description: "Збірка поетичних творів Тараса Шевченка. Демонстраційна книга.",
      authorId: author.id,
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
      genre: "Поезія",
      language: "uk",
      priceEbook: 49.99,
      pricePrint: 199.99,
      pageCount: 320,
      publishedAt: new Date(),
    },
  });

  const book2 = await prisma.book.upsert({
    where: { slug: "tini-zabutykh-predkiv-demo" },
    update: {},
    create: {
      slug: "tini-zabutykh-predkiv-demo",
      title: "Тіні забутих предків (демо)",
      description: "Повість Михайла Коцюбинського. Демонстраційна книга.",
      authorId: author.id,
      status: "DRAFT",
      moderationStatus: "PENDING",
      genre: "Проза",
      language: "uk",
      priceEbook: 39.99,
      pageCount: 180,
    },
  });

  console.log("✅ Seed completed:");
  console.log(`   Admin: ${admin.email} / admin123456`);
  console.log(`   Author: ${author.email} / author123456`);
  console.log(`   Books: "${book1.title}", "${book2.title}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
