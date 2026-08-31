const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Submission", "Subtask", "Task", "Job", "WorkerProfile" RESTART IDENTITY CASCADE;');
  console.log('Truncated all tables.');
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
