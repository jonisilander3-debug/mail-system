const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const env = require("../config/env");
const prisma = require("../lib/prisma");
const { parseRecipientCsv, parseRecipientFile } = require("../utils/csv");
const { normalizeEmail } = require("../utils/unsubscribe");
const { getBoss } = require("../lib/boss");
const {
  sendTestEmail,
  startCampaign,
  updateCampaignStatus,
  getCampaignDiagnostics,
  fixCampaign,
  QUEUE_NAME,
} = require("../services/campaign-service");
const { generateEmailDraft } = require("../services/ai-service");
const {
  listSenderProfiles,
  listSenderProfilesByIds,
  createSenderProfile,
  updateSenderProfile,
  deleteSenderProfile,
  serializeSenderProfile,
} = require("../services/sender-profile-service");
const { serializeAdminUser, verifyAdminCredentials } = require("../services/auth-service");
const {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  listAllowedSenderProfileIdsForUser,
  serializeAdminUserWithAccess,
} = require("../services/admin-user-service");
const {
  getAdminSettings,
  updateSettings,
} = require("../services/settings-service");

function requireJsonAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  return next();
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Try again later." },
});

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHtmlFromRawMessage(rawMessage) {
  return `<p>${escapeHtml(rawMessage).replace(/\r?\n/g, "<br>")}</p>`;
}

async function getAccessibleSenderProfiles(req, scope = "allowed") {
  if (scope === "all" || Number(req.session?.user?.id) === 0) {
    return listSenderProfiles();
  }

  const allowedIds = await listAllowedSenderProfileIdsForUser(req.session?.user?.id);
  return listSenderProfilesByIds(allowedIds);
}

async function getAccessibleSenderProfileIds(req) {
  const allowedProfiles = await getAccessibleSenderProfiles(req);
  return allowedProfiles.map((profile) => profile.id);
}

router.get("/auth/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  return res.json({ user: serializeAdminUser(req.session.user) });
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await verifyAdminCredentials(email, password);

  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid login credentials." });
  }

  req.session.user = serializeAdminUser(user);
  return res.json({ user: req.session.user });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/campaigns", requireJsonAuth, async (req, res) => {
  const allowedProfileIds = await getAccessibleSenderProfileIds(req);
  const campaigns = await prisma.campaign.findMany({
    where: Number(req.session?.user?.id) === 0 ? undefined : { senderProfileId: { in: allowedProfileIds } },
    include: { senderProfile: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ campaigns: campaigns.map(serializeCampaign) });
});

router.post("/campaigns", requireJsonAuth, async (req, res) => {
  const senderProfileId = Number(req.body.senderProfileId);
  const allowedProfileIds = await getAccessibleSenderProfileIds(req);
  if (Number(req.session?.user?.id) !== 0 && !allowedProfileIds.includes(senderProfileId)) {
    return res.status(403).json({ error: "You do not have access to that sender domain." });
  }
  const senderProfile = await prisma.senderProfile.findUnique({
    where: { id: senderProfileId },
  });
  const name = String(req.body.campaignName || req.body.name || "").trim();
  const subject = String(req.body.subject || "").trim();
  const rawMessage = String(req.body.rawMessage || "").trim();
  const htmlBody = String(req.body.htmlBody || "").trim() || toHtmlFromRawMessage(rawMessage);
  const textBody = String(req.body.textBody || "").trim() || rawMessage;
  const rawRecipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];
  const normalizedRecipients = [];
  const recipientSeen = new Set();

  for (const recipient of rawRecipients) {
    const email = normalizeEmail(recipient.email);
    const personName = String(recipient.name || "").trim();

    if (!email || !validator.isEmail(email) || recipientSeen.has(email)) {
      continue;
    }

    recipientSeen.add(email);
    normalizedRecipients.push({
      email,
      name: personName || null,
    });
  }

  if (!senderProfile || !name || !subject || !rawMessage || normalizedRecipients.length === 0) {
    return res.status(400).json({ error: "Sender profile, campaign name, subject, message, and at least one valid recipient are required." });
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const createdCampaign = await tx.campaign.create({
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
        totalRecipients: normalizedRecipients.length,
        validRecipients: normalizedRecipients.length,
        invalidRecipients: 0,
        duplicateCount: 0,
        unsubscribedCount: 0,
      },
    });

    await tx.recipient.createMany({
      data: normalizedRecipients.map((recipient) => ({
        campaignId: createdCampaign.id,
        email: recipient.email,
        name: recipient.name,
        status: "pending",
      })),
      skipDuplicates: true,
    });

    return tx.campaign.findUnique({
      where: { id: createdCampaign.id },
      include: { senderProfile: true },
    });
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

router.get("/campaigns/:id/diagnostics", requireJsonAuth, async (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, senderProfileId: true },
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  if (Number(req.session?.user?.id) !== 0) {
    const allowedProfileIds = await getAccessibleSenderProfileIds(req);
    if (!allowedProfileIds.includes(campaign.senderProfileId)) {
      return res.status(403).json({ error: "You do not have access to that campaign." });
    }
  }

  try {
    const diagnostics = await getCampaignDiagnostics(campaignId);
    return res.json({ diagnostics });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not inspect campaign." });
  }
});

router.post("/campaigns/:id/fix", requireJsonAuth, async (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, senderProfileId: true },
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  if (Number(req.session?.user?.id) !== 0) {
    const allowedProfileIds = await getAccessibleSenderProfileIds(req);
    if (!allowedProfileIds.includes(campaign.senderProfileId)) {
      return res.status(403).json({ error: "You do not have access to that campaign." });
    }
  }

  try {
    const result = await fixCampaign(campaignId);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not run fix for campaign." });
  }
});

router.post("/campaigns/:id/start", requireJsonAuth, async (req, res) => {
  try {
    const campaign = await startCampaign(Number(req.params.id));
    if (!campaign || campaign.status === "draft") {
      return res.status(500).json({ error: "Campaign start did not persist. Try again." });
    }

    return res.json({ ok: true, campaign: serializeCampaign(campaign) });
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

router.post("/ai/generate-email", requireJsonAuth, async (req, res) => {
  const mode = String(req.body.mode || "professional").trim();
  const userText = String(req.body.userText || "").trim();
  const subject = String(req.body.subject || "").trim();
  const senderDomain = String(req.body.senderDomain || "").trim();
  const language = String(req.body.language || "sv").trim();

  if (!userText) {
    return res.status(400).json({ error: "Add some campaign text before asking the AI assistant for help." });
  }

  try {
    const result = await generateEmailDraft({
      mode,
      userText,
      subject,
      senderDomain,
      language,
    });

    return res.json(result);
  } catch (error) {
    if (error.code === "missing_openai_key") {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || "AI email generation failed." });
  }
});

router.post("/recipients/preview", requireJsonAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload a CSV, XLSX, or XLS file." });
  }

  try {
    const preview = parseRecipientFile(req.file);
    return res.json({
      total: preview.total,
      valid: preview.valid,
      invalid: preview.invalid,
      duplicates: preview.duplicates,
      validRecipients: preview.validRecipients,
      rowsPreview: preview.rowsPreview,
      invalidRows: preview.invalidRows,
      duplicateRows: preview.duplicateRows,
      detectedColumns: preview.detectedColumns,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not parse recipients file." });
  }
});

router.post("/upload", requireJsonAuth, upload.single("file"), async (req, res) => {
  const campaignId = Number(req.body.campaignId);
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !req.file) {
    return res.status(400).json({ error: "Campaign and upload file are required." });
  }

  const unsubscribes = await prisma.unsubscribe.findMany({
    where: {
      unsubscribedAt: {
        not: null,
      },
    },
  });
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

router.get("/recipients", requireJsonAuth, async (req, res) => {
  const requestedSenderProfileId = Number(req.query.senderProfileId || 0);
  const allowedProfileIds = await getAccessibleSenderProfileIds(req);
  const senderProfileFilter =
    Number(req.session?.user?.id) === 0
      ? (requestedSenderProfileId ? [requestedSenderProfileId] : null)
      : requestedSenderProfileId
        ? allowedProfileIds.includes(requestedSenderProfileId)
          ? [requestedSenderProfileId]
          : []
        : allowedProfileIds;

  const recipients = await prisma.recipient.findMany({
    where: senderProfileFilter === null
      ? undefined
      : {
          campaign: {
            senderProfileId: {
              in: senderProfileFilter,
            },
          },
        },
    include: {
      campaign: {
        include: {
          senderProfile: true,
        },
      },
    },
    orderBy: [{ email: "asc" }, { createdAt: "desc" }],
    take: 1000,
  });

  const deduped = [];
  const seen = new Set();
  for (const recipient of recipients) {
    const key = recipient.email;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push({
      email: recipient.email,
      name: recipient.name,
      status: recipient.status,
      sentAt: recipient.sentAt,
      campaignName: recipient.campaign.name,
      campaignId: recipient.campaignId,
      senderProfileId: recipient.campaign.senderProfileId,
      domain: recipient.campaign.senderProfile?.domain || "",
      fromEmail: recipient.campaign.senderProfile?.fromEmail || "",
    });
  }

  return res.json({ recipients: deduped });
});

router.get("/settings/domains", requireJsonAuth, async (req, res) => {
  const scope = String(req.query.scope || "allowed").trim().toLowerCase();
  const domains = await getAccessibleSenderProfiles(req, scope);
  return res.json({ domains: domains.map(serializeSenderProfile) });
});

router.get("/settings/app", requireJsonAuth, async (req, res) => {
  const settings = await getAdminSettings();
  return res.json({ settings });
});

router.get("/settings/unsubscribes", requireJsonAuth, async (req, res) => {
  const unsubscribes = await prisma.unsubscribe.findMany({
    where: {
      unsubscribedAt: {
        not: null,
      },
    },
    orderBy: { unsubscribedAt: "desc" },
    take: 500,
  });

  return res.json({
    unsubscribes: unsubscribes.map((entry) => ({
      id: entry.id,
      email: entry.email,
      unsubscribedAt: entry.unsubscribedAt,
    })),
  });
});

router.delete("/settings/unsubscribes/:id", requireJsonAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid unsubscribe entry." });
  }

  const existing = await prisma.unsubscribe.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Unsubscribe entry not found." });
  }

  await prisma.unsubscribe.delete({ where: { id } });
  return res.json({ ok: true });
});

router.put("/settings/app", requireJsonAuth, async (req, res) => {
  const nextSettings = {};
  const openaiModel = String(req.body.openaiModel || "").trim();
  const openaiApiKey = String(req.body.openaiApiKey || "").trim();
  const openaiHtmlPrompt = String(req.body.openaiHtmlPrompt || "").trim();

  if (openaiModel) {
    nextSettings.openaiModel = openaiModel;
  }

  if (openaiApiKey) {
    nextSettings.openaiApiKey = openaiApiKey;
  }

  if (openaiHtmlPrompt) {
    nextSettings.openaiHtmlPrompt = openaiHtmlPrompt;
  }

  if (Object.keys(nextSettings).length === 0) {
    return res.status(400).json({ error: "Add an OpenAI model, HTML prompt, or API key before saving settings." });
  }

  await updateSettings(nextSettings);
  const settings = await getAdminSettings();
  return res.json({ settings });
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

  if (!name || !domain || !fromName || !validator.isEmail(fromEmail)) {
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

router.get("/settings/users", requireJsonAuth, async (req, res) => {
  const users = await listAdminUsers();
  return res.json({ users: users.map(serializeAdminUserWithAccess) });
});

router.post("/settings/users", requireJsonAuth, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const senderProfileIds = Array.isArray(req.body.senderProfileIds)
    ? req.body.senderProfileIds.map((value) => Number(value)).filter(Number.isFinite)
    : [];

  if (!validator.isEmail(email) || password.length < 8) {
    return res.status(400).json({ error: "Enter a valid email and a password with at least 8 characters." });
  }

  try {
    const user = await createAdminUser(email, password, senderProfileIds);
    return res.status(201).json({ user: serializeAdminUserWithAccess(user) });
  } catch (error) {
    return res.status(400).json({ error: "Could not create user. The email may already exist." });
  }
});

router.put("/settings/users/:id", requireJsonAuth, async (req, res) => {
  const id = Number(req.params.id);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const senderProfileIds = Array.isArray(req.body.senderProfileIds)
    ? req.body.senderProfileIds.map((value) => Number(value)).filter(Number.isFinite)
    : [];
  const isActive = Boolean(req.body.isActive);

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  if (password && password.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  try {
    const user = await updateAdminUser(id, {
      email,
      password,
      isActive,
      senderProfileIds,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({ user: serializeAdminUserWithAccess(user) });
  } catch (error) {
    return res.status(400).json({ error: "Could not update user." });
  }
});

module.exports = router;
