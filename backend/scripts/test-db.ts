import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const latestTasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { subtasks: true }
  });
  console.log("Latest Task in DB:");
  console.dir(latestTasks, { depth: null });
}
main();
