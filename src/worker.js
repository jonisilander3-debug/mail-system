const prisma = require("./lib/prisma");
const { bootstrapApp } = require("./services/bootstrap-service");
const { getBoss } = require("./lib/boss");
const { QUEUE_NAME, processCampaignBatch } = require("./services/campaign-service");

async function startWorker() {
  await prisma.$connect();
  await bootstrapApp();
  const boss = await getBoss();
  await boss.createQueue(QUEUE_NAME);

  await boss.work(QUEUE_NAME, async (job) => {
    await processCampaignBatch(job.data.campaignId);
  });

  console.log("Campaign worker is running.");
}

startWorker().catch((error) => {
  console.error("Failed to start worker", error);
  process.exit(1);
});
