const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' }, include: { subtasks: true } });
  console.log(JSON.stringify(tasks, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
