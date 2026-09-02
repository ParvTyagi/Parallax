/// Exercises the attachment endpoints against a real Express app with an
/// in-memory stub for prisma, so no live database is touched.
import express from "express";
import JSZip from "jszip";

const store = new Map<string, any>();
const stub = {
  attachment: {
    upsert: async ({ where, create }: any) => { store.set(where.cid, { cid: where.cid, ...create }); return store.get(where.cid); },
    findUnique: async ({ where }: any) => store.get(where.cid) ?? null
  }
};
require.cache[require.resolve("../src/db/client")] = { exports: { prisma: stub } } as any;

(async () => {
  const ipfsRouter = (await import("../src/routes/ipfs")).default;
  const app = express();
  app.use("/api/ipfs", ipfsRouter);
  const server = app.listen(4599);
  const base = "http://127.0.0.1:4599/api/ipfs";

  const zip = new JSZip();
  zip.file("data/rows.csv", "id,name\n1,alpha\n2,beta\n");
  zip.file("notes/README.md", "# Dataset\nNotes here.");
  const buf = await zip.generateAsync({ type: "nodebuffer" });

  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "application/zip" }), "dataset.zip");
  const up = await fetch(`${base}/upload-file`, { method: "POST", body: fd });
  const meta = await up.json();
  console.log("upload:", up.status, JSON.stringify({ ...meta, entries: meta.entries?.map((e: any) => e.path) }));

  const m = await fetch(`${base}/attachment/${meta.cid}`);
  console.log("manifest:", m.status, (await m.json()).entryCount, "entries");

  const dl = await fetch(`${base}/file/${meta.cid}`);
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  console.log("download:", dl.status, dl.headers.get("content-disposition"), "bytes match:", dlBuf.equals(buf));

  const e = await fetch(`${base}/archive/${meta.cid}/entry?path=${encodeURIComponent("data/rows.csv")}`);
  console.log("entry extract:", e.status, JSON.stringify(await e.text()));

  const bad = await fetch(`${base}/archive/${meta.cid}/entry?path=nope.txt`);
  console.log("missing entry:", bad.status, (await bad.json()).error);

  const missing = await fetch(`${base}/file/QmDoesNotExistAtAll000000000000000000000000`);
  console.log("unknown cid:", missing.status);

  server.close();
})();
