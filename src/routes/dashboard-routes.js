const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", requireAuth, async (req, res) => {
  const [campaigns, unsubscribes, recentFailures] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.unsubscribe.count(),
    prisma.recipient.count({
      where: { status: "failed" },
    }),
  ]);

  const totals = campaigns.reduce((accumulator, campaign) => {
    accumulator.totalRecipients += campaign.validRecipients;
    accumulator.sentCount += campaign.sentCount;
    return accumulator;
  }, { totalRecipients: 0, sentCount: 0 });

  return res.render("dashboard/index", {
    title: "Dashboard",
    campaigns,
    stats: {
      campaignCount: campaigns.length,
      totalRecipients: totals.totalRecipients,
      sentCount: totals.sentCount,
      unsubscribes,
      recentFailures,
    },
  });
});

module.exports = router;
