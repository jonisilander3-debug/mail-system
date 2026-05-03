const express = require("express");
const multer = require("multer");
const validator = require("validator");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { pushFlash } = require("../utils/flash");
const { parseRecipientCsv } = require("../utils/csv");
const { normalizeEmail } = require("../utils/unsubscribe");
const {
  sendTestEmail,
  startCampaign,
  updateCampaignStatus,
  exportCampaignResults,
  QUEUE_NAME,
} = require("../services/campaign-service");
const { getResolvedSettings } = require("../services/settings-service");
const { getBoss } = require("../lib/boss");
const { listSenderProfiles, getDefaultSenderProfile } = require("../services/sender-profile-service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/campaigns", requireAuth, async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return res.render("campaigns/index", {
    title: "Campaigns",
    campaigns,
  });
});

router.get("/campaigns/new", requireAuth, async (req, res) => {
  const [settings, senderProfiles, defaultSenderProfile] = await Promise.all([
    getResolvedSettings(),
    listSenderProfiles(),
    getDefaultSenderProfile(),
  ]);

  return res.render("campaigns/new", {
    title: "Create Campaign",
    defaults: settings,
    senderProfiles,
    defaultSenderProfile,
  });
});

router.post("/campaigns", requireAuth, async (req, res) => {
  const senderProfileId = Number(req.body.senderProfileId);
  const senderProfile = await prisma.senderProfile.findUnique({
    where: { id: senderProfileId },
  });
  const name = String(req.body.name || "").trim();
  const fromName = senderProfile ? senderProfile.fromName : "";
  const fromEmail = senderProfile ? senderProfile.fromEmail : "";
  const subject = String(req.body.subject || "").trim();
  const htmlBody = String(req.body.htmlBody || "").trim();
  const textBody = String(req.body.textBody || "").trim();

  if (!senderProfile || !name || !fromName || !subject || !htmlBody || !textBody || !validator.isEmail(fromEmail)) {
    pushFlash(req, "error", "Choose a sender profile and complete all campaign fields.");
    return res.redirect("/campaigns/new");
  }

  const campaign = await prisma.campaign.create({
    data: {
      senderProfileId: senderProfile.id,
      name,
      fromName,
      fromEmail,
      subject,
      htmlBody,
      textBody,
      includeUnsubscribe: req.body.includeUnsubscribe === "on",
      status: "draft",
    },
  });

  pushFlash(req, "success", "Campaign created. Upload recipients and send a test email next.");
  return res.redirect(`/campaigns/${campaign.id}`);
});

router.get("/campaigns/:id", requireAuth, async (req, res) => {
  const campaignId = Number(req.params.id);
  const [campaign, recipients, failedRecipients] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { senderProfile: true },
    }),
    prisma.recipient.findMany({
      where: { campaignId },
      take: 10,
      orderBy: { id: "asc" },
    }),
    prisma.recipient.findMany({
      where: {
        campaignId,
        status: "failed",
      },
      orderBy: { id: "asc" },
      take: 50,
    }),
  ]);

  if (!campaign) {
    return res.status(404).render("error", {
      title: "Campaign not found",
      error: new Error("Campaign not found."),
    });
  }

  const importSummary = req.session.importSummary || null;
  delete req.session.importSummary;

  return res.render("campaigns/show", {
    title: campaign.name,
    campaign,
    recipients,
    failedRecipients,
    importSummary,
  });
});

router.post("/campaigns/:id/upload", requireAuth, upload.single("csvFile"), async (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { senderProfile: true },
  });
  if (!campaign) {
    pushFlash(req, "error", "Campaign not found.");
    return res.redirect("/campaigns");
  }

  if (!req.file) {
    pushFlash(req, "error", "Upload a CSV file first.");
    return res.redirect(`/campaigns/${campaignId}`);
  }

  const unsubscribes = await prisma.unsubscribe.findMany();
  const unsubscribedSet = new Set(unsubscribes.map((item) => item.email));
  const parsed = parseRecipientCsv(req.file.buffer, unsubscribedSet);

  await prisma.$transaction([
    prisma.sendAttempt.deleteMany({ where: { campaignId } }),
    prisma.recipient.deleteMany({ where: { campaignId } }),
    prisma.recipient.createMany({
      data: parsed.validRecipients.map((recipient) => ({
        campaignId,
        email: recipient.email,
        name: recipient.name,
        status: "pending",
      })),
      skipDuplicates: true,
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalRecipients: parsed.totalUploaded,
        validRecipients: parsed.validRecipients.length,
        invalidRecipients: parsed.invalidRecipients.length,
        duplicateCount: parsed.duplicatesRemoved,
        unsubscribedCount: parsed.unsubscribedSkipped,
        sentCount: 0,
        failedCount: 0,
        status: campaign.testSentAt ? "ready" : "draft",
      },
    }),
  ]);

  req.session.importSummary = parsed;
  pushFlash(req, "success", "Recipient CSV processed successfully.");
  return res.redirect(`/campaigns/${campaignId}`);
});

router.post("/campaigns/:id/test", requireAuth, async (req, res) => {
  const campaignId = Number(req.params.id);
  const testEmail = normalizeEmail(req.body.testEmail);

  if (!validator.isEmail(testEmail)) {
    pushFlash(req, "error", "Enter a valid test email address.");
    return res.redirect(`/campaigns/${campaignId}`);
  }

  try {
    await sendTestEmail(campaignId, testEmail);
    pushFlash(req, "success", `Test email sent to ${testEmail}.`);
  } catch (error) {
    pushFlash(req, "error", error.message);
  }

  return res.redirect(`/campaigns/${campaignId}`);
});

router.post("/campaigns/:id/start", requireAuth, async (req, res) => {
  const campaignId = Number(req.params.id);

  try {
    await startCampaign(campaignId);
    pushFlash(req, "success", "Campaign started and queued for sending.");
  } catch (error) {
    pushFlash(req, "error", error.message);
  }

  return res.redirect(`/campaigns/${campaignId}`);
});

router.post("/campaigns/:id/pause", requireAuth, async (req, res) => {
  await updateCampaignStatus(Number(req.params.id), "paused");
  pushFlash(req, "success", "Campaign paused.");
  return res.redirect(`/campaigns/${req.params.id}`);
});

router.post("/campaigns/:id/resume", requireAuth, async (req, res) => {
  const campaignId = Number(req.params.id);
  await updateCampaignStatus(campaignId, "sending");
  const boss = await getBoss();
  await boss.send(QUEUE_NAME, { campaignId });
  pushFlash(req, "success", "Campaign resumed.");
  return res.redirect(`/campaigns/${req.params.id}`);
});

router.post("/campaigns/:id/stop", requireAuth, async (req, res) => {
  await updateCampaignStatus(Number(req.params.id), "stopped");
  pushFlash(req, "success", "Campaign stopped.");
  return res.redirect(`/campaigns/${req.params.id}`);
});

router.get("/campaigns/:id/export", requireAuth, async (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

  if (!campaign) {
    pushFlash(req, "error", "Campaign not found.");
    return res.redirect("/campaigns");
  }

  const csv = await exportCampaignResults(campaignId);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${campaignId}-results.csv"`);
  return res.send(csv);
});

module.exports = router;
