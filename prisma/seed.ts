import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@skladcom.ua";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Адміністратор",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`✓ Admin created: ${email}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
