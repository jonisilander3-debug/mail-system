const { Parser } = require("json2csv");
const postmark = require("postmark");
const prisma = require("../lib/prisma");
const { getBoss } = require("../lib/boss");
const { getResolvedSettings } = require("./settings-service");
const { ensureUnsubscribeToken, normalizeEmail } = require("../utils/unsubscribe");
const {
  replaceTokens,
  appendUnsubscribeHtml,
  appendUnsubscribeText,
} = require("../utils/template");

const QUEUE_NAME = "send-campaign-batch";
const MISSING_POSTMARK_TOKEN_ERROR = "Postmark API key saknas för vald domän. Lägg till den under Domäner & API.";

async function queueCampaignBatch(campaignId, delaySeconds = 0) {
  const boss = await getBoss();
  const options = delaySeconds > 0
    ? { startAfter: new Date(Date.now() + delaySeconds * 1000) }
    : undefined;

  await boss.send(QUEUE_NAME, { campaignId }, options);
}

async function recalculateCampaignCounts(campaignId) {
  const [campaign, recipients] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.recipient.findMany({
      where: { campaignId },
      select: { status: true, errorMessage: true },
    }),
  ]);

  if (!campaign) {
    return null;
  }

  const sentCount = recipients.filter((item) => item.status === "sent").length;
  const failedCount = recipients.filter((item) => item.status === "failed").length;

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount,
      failedCount,
    },
  });
}

function buildUnsubscribeUrl(baseUrl, token) {
  return `${baseUrl.replace(/\/$/, "")}/unsubscribe?token=${token}`;
}

async function sendTestEmail(campaignId, testEmail) {
  const [campaign, settings] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { senderProfile: true },
    }),
    getResolvedSettings(),
  ]);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (!campaign.senderProfile?.postmarkToken) {
    throw new Error(MISSING_POSTMARK_TOKEN_ERROR);
  }

  const client = new postmark.ServerClient(campaign.senderProfile.postmarkToken);
  const token = await ensureUnsubscribeToken(testEmail);
  const unsubscribeUrl = campaign.includeUnsubscribe
    ? buildUnsubscribeUrl(settings.appBaseUrl, token)
    : "";

  await client.sendEmail({
    From: `${campaign.fromName} <${campaign.fromEmail}>`,
    To: normalizeEmail(testEmail),
    Subject: `[TEST] ${campaign.subject}`,
    HtmlBody: appendUnsubscribeHtml(
      replaceTokens(campaign.htmlBody, { email: testEmail, name: "Test Recipient" }, unsubscribeUrl),
      unsubscribeUrl,
    ),
    TextBody: appendUnsubscribeText(
      replaceTokens(campaign.textBody, { email: testEmail, name: "Test Recipient" }, unsubscribeUrl),
      unsubscribeUrl,
    ),
    MessageStream: campaign.senderProfile.messageStream || "broadcast",
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      testSentAt: new Date(),
      lastTestEmail: normalizeEmail(testEmail),
      status: campaign.status === "draft" ? "ready" : campaign.status,
    },
  });
}

async function updateCampaignStatus(campaignId, status) {
  const data = { status };

  if (status === "sending") {
    data.startedAt = new Date();
    data.completedAt = null;
  }

  if (status === "completed" || status === "stopped" || status === "failed") {
    data.completedAt = new Date();
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data,
  });
}

async function startCampaign(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { senderProfile: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (!campaign.testSentAt) {
    throw new Error("A test email must be sent before starting the campaign.");
  }

  if (campaign.validRecipients < 1) {
    throw new Error("Upload at least one valid recipient before starting.");
  }

  if (!campaign.senderProfile?.postmarkToken) {
    throw new Error(MISSING_POSTMARK_TOKEN_ERROR);
  }

  await updateCampaignStatus(campaignId, "sending");
  await queueCampaignBatch(campaignId);
}

async function processCampaignBatch(campaignId) {
  const [campaign, settings] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { senderProfile: true },
    }),
    getResolvedSettings(),
  ]);

  if (!campaign || campaign.status !== "sending") {
    return;
  }

  if (!campaign.senderProfile?.postmarkToken) {
    await updateCampaignStatus(campaignId, "failed");
    throw new Error(MISSING_POSTMARK_TOKEN_ERROR);
  }

  const recipients = await prisma.recipient.findMany({
    where: {
      campaignId,
      status: "pending",
    },
    orderBy: { id: "asc" },
    take: settings.batchSize,
  });

  if (recipients.length === 0) {
    await recalculateCampaignCounts(campaignId);
    await updateCampaignStatus(campaignId, "completed");
    return;
  }

  const client = new postmark.ServerClient(campaign.senderProfile.postmarkToken);
  const unsubscribed = await prisma.unsubscribe.findMany({
    where: {
      email: { in: recipients.map((item) => item.email) },
    },
  });
  const unsubscribedSet = new Set(unsubscribed.map((item) => item.email));

  const messages = [];
  const indexMap = [];

  for (const recipient of recipients) {
    if (unsubscribedSet.has(recipient.email)) {
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          status: "skipped",
          errorMessage: "Recipient unsubscribed",
        },
      });
      continue;
    }

    const token = await ensureUnsubscribeToken(recipient.email);
    const unsubscribeUrl = campaign.includeUnsubscribe
      ? buildUnsubscribeUrl(settings.appBaseUrl, token)
      : "";

    messages.push({
      From: `${campaign.fromName} <${campaign.fromEmail}>`,
      To: recipient.email,
      Subject: replaceTokens(campaign.subject, recipient, unsubscribeUrl),
      HtmlBody: appendUnsubscribeHtml(
        replaceTokens(campaign.htmlBody, recipient, unsubscribeUrl),
        unsubscribeUrl,
      ),
      TextBody: appendUnsubscribeText(
        replaceTokens(campaign.textBody, recipient, unsubscribeUrl),
        unsubscribeUrl,
      ),
      MessageStream: campaign.senderProfile.messageStream || "broadcast",
    });
    indexMap.push(recipient);
  }

  if (messages.length === 0) {
    await recalculateCampaignCounts(campaignId);
    await queueCampaignBatch(campaignId, settings.batchDelaySeconds);
    return;
  }

  const results = await client.sendEmailBatch(messages);

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const recipient = indexMap[i];

    const success = result.ErrorCode === 0;
    await prisma.recipient.update({
      where: { id: recipient.id },
      data: {
        status: success ? "sent" : "failed",
        postmarkMessageId: result.MessageID || null,
        errorMessage: success ? null : result.Message,
        sentAt: success ? new Date() : null,
      },
    });

    await prisma.sendAttempt.create({
      data: {
        campaignId,
        recipientId: recipient.id,
        status: success ? "sent" : "failed",
        requestPayload: messages[i],
        responsePayload: result,
        errorMessage: success ? null : result.Message,
      },
    });
  }

  const updated = await recalculateCampaignCounts(campaignId);
  const pendingRemaining = await prisma.recipient.count({
    where: {
      campaignId,
      status: "pending",
    },
  });

  if (!updated) {
    return;
  }

  if (pendingRemaining === 0) {
    await updateCampaignStatus(campaignId, "completed");
    return;
  }

  if (updated.status === "sending") {
    await queueCampaignBatch(campaignId, settings.batchDelaySeconds);
  }
}

async function exportCampaignResults(campaignId) {
  const recipients = await prisma.recipient.findMany({
    where: { campaignId },
    orderBy: { id: "asc" },
  });

  const parser = new Parser({
    fields: [
      "email",
      "name",
      "status",
      "postmarkMessageId",
      "errorMessage",
      "sentAt",
      "createdAt",
    ],
  });

  return parser.parse(recipients);
}

module.exports = {
  QUEUE_NAME,
  sendTestEmail,
  startCampaign,
  processCampaignBatch,
  exportCampaignResults,
  updateCampaignStatus,
};
