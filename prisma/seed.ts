import { PrismaClient, Role } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = hashSync("password123", 10);

const demoUsers = [
  { email: "admin@pallettrack.local", name: "Admin User", roles: [Role.administrator] },
  { email: "manufacturing@pallettrack.local", name: "Factory Worker", roles: [Role.manufacturing] },
  { email: "loader@pallettrack.local", name: "Warehouse Loader", roles: [Role.warehouse_loader] },
  { email: "dispatcher@pallettrack.local", name: "Dispatcher", roles: [Role.dispatcher] },
  { email: "receiver@pallettrack.local", name: "Delivery Receiver", roles: [Role.delivery_receiver] },
  { email: "collector@pallettrack.local", name: "Return Collector", roles: [Role.return_collector] },
  { email: "factory@pallettrack.local", name: "Factory Receiver", roles: [Role.factory_receiver] },
  { email: "manager@pallettrack.local", name: "Operations Manager", roles: [Role.manager] },
  // Phase 4 demo — a single user combining dispatcher + delivery receiver (Q4)
  { email: "combined@pallettrack.local", name: "Combined Dispatcher/Receiver", roles: [Role.dispatcher, Role.delivery_receiver] },
];

async function main() {
  console.log("Seeding users...");
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { roles: u.roles },
      create: {
        email: u.email,
        name: u.name,
        role: u.roles[0],
        roles: u.roles,
        passwordHash: PASSWORD,
      },
    });
    console.log(`  ✓ ${u.email} (${u.roles.join("/")})`);
  }

  console.log("Seeding settings...");
  await prisma.setting.upsert({
    where: { key: "return_window_days" },
    update: {},
    create: { key: "return_window_days", value: "14" },
  });
  await prisma.setting.upsert({
    where: { key: "low_inventory_threshold" },
    update: {},
    create: { key: "low_inventory_threshold", value: "50" },
  });
  await prisma.setting.upsert({
    where: { key: "label_company_name" },
    update: {},
    create: { key: "label_company_name", value: "PalletTrack Pro" },
  });
  await prisma.setting.upsert({
    where: { key: "label_company_tagline" },
    update: {},
    create: { key: "label_company_tagline", value: "Returnable Pallet" },
  });
  await prisma.setting.upsert({
    where: { key: "label_accent_color" },
    update: {},
    create: { key: "label_accent_color", value: "#1e40af" },
  });
  await prisma.setting.upsert({
    where: { key: "label_footer_text" },
    update: {},
    create: { key: "label_footer_text", value: "Scan to track · do not remove" },
  });

  console.log("Seed complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
