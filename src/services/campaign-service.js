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
const activeCampaignRuns = new Set();
const MISSING_POSTMARK_TOKEN_ERROR = "Postmark API key saknas för vald domän. Lägg till den under Domäner & API.";

async function queueCampaignBatch(campaignId, delaySeconds = 0) {
  const boss = await getBoss();
  const options = delaySeconds > 0
    ? { startAfter: new Date(Date.now() + delaySeconds * 1000) }
    : undefined;

  await boss.send(QUEUE_NAME, { campaignId }, options);
}

async function queueCampaignBatchSafely(campaignId, delaySeconds = 0) {
  try {
    await queueCampaignBatch(campaignId, delaySeconds);
  } catch (error) {
    console.error(`Queue scheduling failed for campaign ${campaignId}`, error);
  }
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

  if (campaign.validRecipients < 1) {
    throw new Error("Upload at least one valid recipient before starting.");
  }

  if (!campaign.senderProfile?.postmarkToken) {
    throw new Error(MISSING_POSTMARK_TOKEN_ERROR);
  }

  const startedCampaign = await updateCampaignStatus(campaignId, "sending");
  await queueCampaignBatchSafely(campaignId);
  await processCampaignBatch(campaignId);

  return prisma.campaign.findUnique({
    where: { id: startedCampaign.id },
    include: { senderProfile: true },
  });
}

function scheduleCampaignProcessingFallback(campaignId, delaySeconds = 0) {
  setTimeout(() => {
    processCampaignBatch(campaignId).catch((error) => {
      console.error(`Fallback campaign processing failed for campaign ${campaignId}`, error);
    });
  }, Math.max(250, delaySeconds * 1000));
}

async function processCampaignBatch(campaignId) {
  if (activeCampaignRuns.has(campaignId)) {
    return;
  }

  activeCampaignRuns.add(campaignId);

  try {
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
      unsubscribedAt: {
        not: null,
      },
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
    await queueCampaignBatchSafely(campaignId, settings.batchDelaySeconds);
    scheduleCampaignProcessingFallback(campaignId, settings.batchDelaySeconds);
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
    await queueCampaignBatchSafely(campaignId, settings.batchDelaySeconds);
    scheduleCampaignProcessingFallback(campaignId, settings.batchDelaySeconds);
  }
  } finally {
    activeCampaignRuns.delete(campaignId);
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

function getTopErrorMessage(recipients) {
  const counts = new Map();

  for (const recipient of recipients) {
    if (!recipient.errorMessage) {
      continue;
    }

    counts.set(recipient.errorMessage, (counts.get(recipient.errorMessage) || 0) + 1);
  }

  let winner = "";
  let winnerCount = 0;
  for (const [message, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = message;
      winnerCount = count;
    }
  }

  return winner;
}

async function getCampaignDiagnostics(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      senderProfile: true,
      recipients: {
        orderBy: { id: "asc" },
      },
      sendAttempts: {
        orderBy: { attemptedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const pendingCount = campaign.recipients.filter((recipient) => recipient.status === "pending").length;
  const sentCount = campaign.recipients.filter((recipient) => recipient.status === "sent").length;
  const failedCount = campaign.recipients.filter((recipient) => recipient.status === "failed").length;
  const skippedCount = campaign.recipients.filter((recipient) => recipient.status === "skipped").length;
  const unsubscribedSkips = campaign.recipients.filter(
    (recipient) => recipient.errorMessage === "Recipient unsubscribed",
  ).length;
  const attemptCount = campaign.sendAttempts.length;
  const topErrorMessage = getTopErrorMessage(campaign.recipients);
  const startedAgeSeconds = campaign.startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(campaign.startedAt).getTime()) / 1000))
    : null;

  let health = "info";
  let summary = "Kampanjen har inte analyserats an.";
  let recommendation = "Uppdatera sidan och kontrollera senaste status igen.";

  if (campaign.status === "draft") {
    health = "warning";
    summary = "Kampanjen ligger fortfarande som utkast och har inte borjat skicka.";
    recommendation = "Forsok starta kampanjen igen. Om det hander flera ganger, kontrollera kampanjstatus direkt har igen.";
  } else if (campaign.status === "sending" && attemptCount === 0 && pendingCount > 0) {
    health = startedAgeSeconds !== null && startedAgeSeconds > 60 ? "error" : "warning";
    summary =
      health === "error"
        ? "Kampanjen ser ut att ha fastnat innan forsta batchen skickades."
        : "Kampanjen har startat men forsta batchen verkar inte vara skickad an.";
    recommendation =
      "Vanta en kort stund och kontrollera igen. Om den fortsatter sta still utan skickforsok behover kampanjen startas om eller ko-logiken ses over.";
  } else if (campaign.status === "sending" && attemptCount > 0 && pendingCount > 0) {
    health = "ok";
    summary = "Utskicket pagar och fler mottagare ligger fortfarande i ko.";
    recommendation = "Ingen atgard behovs just nu. Uppdatera igen om en liten stund for att se fler skickforsok.";
  } else if (campaign.status === "completed" && sentCount > 0 && failedCount === 0) {
    health = "ok";
    summary = `Kampanjen ar klar. ${sentCount} av ${campaign.validRecipients} mail skickades.`;
    recommendation = "Ingen atgard behovs. Kontrollera Kampanjer for slutstatus.";
  } else if (failedCount > 0 && topErrorMessage.includes("Sender Signature")) {
    health = "error";
    summary = "Postmark blockerar utskicket eftersom From-adressen inte ar verifierad.";
    recommendation =
      "Verifiera From-adressen eller hela domanen i Postmark for den valda API-nyckeln och forsok sedan igen.";
  } else if (unsubscribedSkips > 0) {
    health = skippedCount === campaign.validRecipients ? "warning" : "info";
    summary =
      skippedCount === campaign.validRecipients
        ? "Alla mottagare stoppades eftersom de ar markerade som unsubscribed."
        : `${unsubscribedSkips} mottagare hoppades over eftersom de ar unsubscribed.`;
    recommendation = "Kontrollera unsubscribe-listan under Installningar om nagon adress stoppats felaktigt.";
  } else if (failedCount > 0) {
    health = "error";
    summary = `${failedCount} mottagare misslyckades att skickas.`;
    recommendation = topErrorMessage || "Kontrollera senaste felmeddelande och forsok igen.";
  } else if (campaign.status === "completed" && skippedCount > 0) {
    health = "warning";
    summary = "Kampanjen ar klar men vissa mottagare hoppades over.";
    recommendation = "Kontrollera unsubscribe-listan och mottagarnas status for att se varfor de stoppades.";
  } else if (campaign.status === "failed") {
    health = "error";
    summary = "Kampanjen markerades som misslyckad.";
    recommendation = topErrorMessage || "Kontrollera felmeddelanden och gor ett nytt forsok nar problemet ar lost.";
  }

  return {
    campaignId: campaign.id,
    health,
    summary,
    recommendation,
    counts: {
      pending: pendingCount,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      attempts: attemptCount,
      unsubscribedSkips,
    },
    startedAgeSeconds,
    topErrorMessage: topErrorMessage || null,
    status: campaign.status,
    lastAttemptAt: campaign.sendAttempts[0]?.attemptedAt || null,
  };
}

module.exports = {
  QUEUE_NAME,
  sendTestEmail,
  startCampaign,
  processCampaignBatch,
  exportCampaignResults,
  getCampaignDiagnostics,
  updateCampaignStatus,
};
