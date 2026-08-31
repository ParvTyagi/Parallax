const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema='public' AND column_name='status'
  `);
  console.log(cols);
  const types = await prisma.$queryRawUnsafe(`
    SELECT typname FROM pg_type WHERE typname ILIKE '%status%' OR typname ILIKE '%state%'
  `);
  console.log(types);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
