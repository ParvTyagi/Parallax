const EmbeddedPostgres = require('embedded-postgres').default;
const path = require('path');
const fs = require('fs');

async function main() {
  const dataDir = path.resolve(__dirname, '../data/postgres');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'password',
    port: 5432,
    persistent: true,
  });

  console.log('Initializing embedded postgres...');
  try {
    await pg.initialise();
  } catch (e) {
    console.log('Initialize notice:', e.message);
  }

  console.log('Starting embedded postgres server...');
  await pg.start();
  console.log('Embedded PostgreSQL is running on port 5432!');

  try {
    await pg.createDatabase('parallax');
    console.log('Database "parallax" created!');
  } catch (e) {
    console.log('Database notice:', e.message);
  }

  // Keep process alive
  setInterval(() => {}, 1000000);
}

main().catch((err) => {
  console.error('Embedded Postgres failed to start:', err);
  process.exit(1);
});
