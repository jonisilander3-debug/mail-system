const { PgBoss } = require("pg-boss");
const env = require("../config/env");

let boss;

async function getBoss() {
  if (!boss) {
    boss = new PgBoss({
      connectionString: env.databaseUrl,
      schema: "pgboss",
      migrate: true,
    });
    await boss.start();
  }

  return boss;
}

module.exports = { getBoss };
