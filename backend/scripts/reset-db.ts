/**
 * Wipes indexed task data so the app starts from a clean slate.
 *
 *   npx ts-node --transpile-only scripts/reset-db.ts --yes
 *
 * Deletes Task/Subtask/Submission/Job/SpecDraft/Attachment/IpfsText.
 *
 * ChainCursor is KEPT by default. The cursor is what stops the poller from
 * re-indexing the tasks you just deleted straight back out of the chain — the
 * events are still on Monad forever. Pass --reset-cursor only if you actually
 * want to re-scan, and note that with CHAIN_START_BLOCK unset the poller falls
 * back to `currentBlock - 200`, which silently skips anything older.
 *
 * WorkerProfile is KEPT: reputation is earned across tasks and is not task data.
 * Pass --wipe-workers to clear it too.
 */
import { prisma } from "../src/db/client";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const args = new Set(process.argv.slice(2));
  const confirmed = args.has("--yes");
  const resetCursor = args.has("--reset-cursor");
  const wipeWorkers = args.has("--wipe-workers");

  const counts = {
    tasks: await prisma.task.count(),
    subtasks: await prisma.subtask.count(),
    submissions: await prisma.submission.count(),
    jobs: await prisma.job.count(),
    specDrafts: await prisma.specDraft.count(),
    attachments: await prisma.attachment.count(),
    ipfsTexts: await prisma.ipfsText.count(),
    workerProfiles: await prisma.workerProfile.count(),
    chainCursors: await prisma.chainCursor.count()
  };

  console.log("Current rows:");
  console.table(counts);

  if (!confirmed) {
    console.log("\nDry run. Nothing was deleted. Re-run with --yes to apply.");
    console.log("Optional: --reset-cursor (re-scan the chain), --wipe-workers (clear reputation).");
    await prisma.$disconnect();
    return;
  }

  // Ordered by foreign key: Submission -> Subtask -> Task.
  const deleted = {
    submissions: (await prisma.submission.deleteMany({})).count,
    subtasks: (await prisma.subtask.deleteMany({})).count,
    tasks: (await prisma.task.deleteMany({})).count,
    jobs: (await prisma.job.deleteMany({})).count,
    specDrafts: (await prisma.specDraft.deleteMany({})).count,
    attachments: (await prisma.attachment.deleteMany({})).count,
    ipfsTexts: (await prisma.ipfsText.deleteMany({})).count,
    workerProfiles: wipeWorkers ? (await prisma.workerProfile.deleteMany({})).count : 0,
    chainCursors: resetCursor ? (await prisma.chainCursor.deleteMany({})).count : 0
  };

  console.log("\nDeleted:");
  console.table(deleted);

  const cursor = await prisma.chainCursor.findMany();
  console.log(
    resetCursor
      ? "Chain cursor reset — the poller will restart near the chain tip on next boot."
      : `Chain cursor kept: ${cursor.map((c) => `${c.id} @ ${c.lastBlock}`).join(", ") || "none"}`
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Reset failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
