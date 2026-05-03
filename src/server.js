const env = require("./config/env");
const { createApp } = require("./app");
const prisma = require("./lib/prisma");
const { bootstrapApp } = require("./services/bootstrap-service");
const { getBoss } = require("./lib/boss");
const { QUEUE_NAME, processCampaignBatch } = require("./services/campaign-service");

async function startServer() {
  await prisma.$connect();
  await bootstrapApp();
  const boss = await getBoss();
  await boss.createQueue(QUEUE_NAME);

  await boss.work(QUEUE_NAME, async (job) => {
    await processCampaignBatch(job.data.campaignId);
  });

  const app = createApp();
  app.listen(env.port, env.host, () => {
    console.log(`Email campaign app listening on ${env.host}:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
