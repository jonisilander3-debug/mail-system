const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { parseRecipientCsv } = require("../utils/csv");
const { normalizeEmail } = require("../utils/unsubscribe");
const { getBoss } = require("../lib/boss");
const {
  sendTestEmail,
  startCampaign,
  updateCampaignStatus,
  QUEUE_NAME,
} = require("../services/campaign-service");
const {
  listSenderProfiles,
  createSenderProfile,
  updateSenderProfile,
  deleteSenderProfile,
  serializeSenderProfile,
} = require("../services/sender-profile-service");

function requireJsonAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  return next();
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function serializeCampaign(campaign) {
  return {
    id: campaign.id,
    senderProfileId: campaign.senderProfileId,
    name: campaign.name,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    subject: campaign.subject,
    htmlBody: campaign.htmlBody,
    textBody: campaign.textBody,
    includeUnsubscribe: campaign.includeUnsubscribe,
    status: campaign.status,
    totalRecipients: campaign.totalRecipients,
    validRecipients: campaign.validRecipients,
    invalidRecipients: campaign.invalidRecipients,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    duplicateCount: campaign.duplicateCount,
    unsubscribedCount: campaign.unsubscribedCount,
    testSentAt: campaign.testSentAt,
    lastTestEmail: campaign.lastTestEmail,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    senderProfile: campaign.senderProfile ? serializeSenderProfile(campaign.senderProfile) : null,
  };
}

router.post("/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await prisma.adminUser.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid login credentials." });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid login credentials." });
  }

  req.session.user = { id: user.id, email: user.email };
  return res.json({ user: req.session.user });
});

router.get("/campaigns", requireJsonAuth, async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    include: { senderProfile: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ campaigns: campaigns.map(serializeCampaign) });
});

router.post("/campaigns", requireJsonAuth, async (req, res) => {
  const senderProfileId = Number(req.body.senderProfileId);
  const senderProfile = await prisma.senderProfile.findUnique({
    where: { id: senderProfileId },
  });
  const name = String(req.body.name || "").trim();
  const subject = String(req.body.subject || "").trim();
  const htmlBody = String(req.body.htmlBody || "").trim();
  const textBody = String(req.body.textBody || "").trim();

  if (!senderProfile || !name || !subject || !htmlBody || !textBody) {
    return res.status(400).json({ error: "Missing campaign fields or sender profile." });
  }

  const campaign = await prisma.campaign.create({
    data: {
      senderProfileId: senderProfile.id,
      name,
      fromName: senderProfile.fromName,
      fromEmail: senderProfile.fromEmail,
      subject,
      htmlBody,
      textBody,
      includeUnsubscribe: Boolean(req.body.includeUnsubscribe),
      status: "draft",
    },
    include: { senderProfile: true },
  });

  return res.status(201).json({ campaign: serializeCampaign(campaign) });
});

router.get("/campaigns/:id", requireJsonAuth, async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      senderProfile: true,
      recipients: {
        take: 100,
        orderBy: { id: "asc" },
      },
    },
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  return res.json({ campaign: serializeCampaign(campaign), recipients: campaign.recipients });
});

router.post("/campaigns/:id/start", requireJsonAuth, async (req, res) => {
  try {
    await startCampaign(Number(req.params.id));
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post("/campaigns/:id/pause", requireJsonAuth, async (req, res) => {
  await updateCampaignStatus(Number(req.params.id), "paused");
  return res.json({ ok: true });
});

router.post("/campaigns/:id/resume", requireJsonAuth, async (req, res) => {
  const campaignId = Number(req.params.id);
  await updateCampaignStatus(campaignId, "sending");
  const boss = await getBoss();
  await boss.send(QUEUE_NAME, { campaignId });
  return res.json({ ok: true });
});

router.post("/upload", requireJsonAuth, upload.single("file"), async (req, res) => {
  const campaignId = Number(req.body.campaignId);
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !req.file) {
    return res.status(400).json({ error: "Campaign and upload file are required." });
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

  return res.json({ summary: parsed });
});

router.post("/test-email", requireJsonAuth, async (req, res) => {
  const campaignId = Number(req.body.campaignId);
  const testEmail = normalizeEmail(req.body.testEmail);

  if (!validator.isEmail(testEmail)) {
    return res.status(400).json({ error: "Valid test email required." });
  }

  try {
    await sendTestEmail(campaignId, testEmail);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get("/settings/domains", async (req, res) => {
  const domains = await listSenderProfiles();
  return res.json({ domains: domains.map(serializeSenderProfile) });
});

router.post("/settings/domains", requireJsonAuth, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const domain = String(req.body.domain || "").trim().toLowerCase();
  const fromName = String(req.body.fromName || "").trim();
  const fromEmail = String(req.body.fromEmail || "").trim().toLowerCase();
  const postmarkToken = String(req.body.postmarkToken || "").trim();
  const messageStream = String(req.body.messageStream || "broadcast").trim();
  const status = String(req.body.status || "active").trim();
  const isDefault = Boolean(req.body.isDefault);

  if (!name || !domain || !fromName || !validator.isEmail(fromEmail) || !postmarkToken) {
    return res.status(400).json({ error: "Missing sender profile fields." });
  }

  try {
    const profile = await createSenderProfile({
      name,
      domain,
      fromName,
      fromEmail,
      postmarkToken,
      messageStream,
      status,
      isDefault,
    });
    return res.status(201).json({ domain: serializeSenderProfile(profile) });
  } catch (error) {
    return res.status(400).json({ error: "Could not create sender profile." });
  }
});

router.put("/settings/domains/:id", requireJsonAuth, async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || "").trim();
  const domain = String(req.body.domain || "").trim().toLowerCase();
  const fromName = String(req.body.fromName || "").trim();
  const fromEmail = String(req.body.fromEmail || "").trim().toLowerCase();
  const postmarkToken = String(req.body.postmarkToken || "").trim();
  const messageStream = String(req.body.messageStream || "broadcast").trim();
  const status = String(req.body.status || "active").trim();
  const isDefault = Boolean(req.body.isDefault);

  if (!name || !domain || !fromName || !validator.isEmail(fromEmail)) {
    return res.status(400).json({ error: "Missing sender profile fields." });
  }

  try {
    const profile = await updateSenderProfile(id, {
      name,
      domain,
      fromName,
      fromEmail,
      postmarkToken,
      messageStream,
      status,
      isDefault,
    });

    if (!profile) {
      return res.status(404).json({ error: "Sender profile not found." });
    }

    return res.json({ domain: serializeSenderProfile(profile) });
  } catch (error) {
    return res.status(400).json({ error: "Could not update sender profile." });
  }
});

router.delete("/settings/domains/:id", requireJsonAuth, async (req, res) => {
  try {
    const profile = await deleteSenderProfile(Number(req.params.id));
    if (!profile) {
      return res.status(404).json({ error: "Sender profile not found." });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
