const prisma = require("../lib/prisma");
const env = require("../config/env");

const settingKeys = ["batchSize", "batchDelaySeconds", "appBaseUrl", "openaiApiKey", "openaiModel", "openaiHtmlPrompt"];

const defaultOpenAiHtmlPrompt = [
  "Create a premium marketing email template that feels modern, trustworthy, and conversion-focused.",
  "Use a clear content hierarchy with a strong headline, supporting copy, one main CTA button, and a clean footer.",
  "Keep the layout email-safe and broadly compatible across major email clients.",
  "Use inline CSS only, soft spacing, rounded sections where appropriate, and a polished Scandinavian SaaS feel.",
  "Make the HTML visually stronger than a plain text-to-HTML conversion while still staying lightweight and easy to read.",
].join(" ");

function maskSecret(value, { prefix = "", visibleSuffix = 4 } = {}) {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }

  const suffix = input.slice(-visibleSuffix);
  return `${prefix}****${suffix}`;
}

async function getSettingsMap() {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: settingKeys } },
  });

  return settings.reduce((accumulator, item) => {
    accumulator[item.key] = item.value;
    return accumulator;
  }, {});
}

async function getResolvedSettings() {
  const map = await getSettingsMap();

  return {
    batchSize: Number(map.batchSize || env.defaultBatchSize || 100),
    batchDelaySeconds: Number(map.batchDelaySeconds || env.defaultBatchDelaySeconds || 60),
    appBaseUrl: map.appBaseUrl || env.appBaseUrl,
    openaiApiKey: map.openaiApiKey || env.openaiApiKey || "",
    openaiModel: map.openaiModel || env.openaiModel || "gpt-5.4-mini",
    openaiHtmlPrompt: map.openaiHtmlPrompt || defaultOpenAiHtmlPrompt,
  };
}

async function getAdminSettings() {
  const settings = await getResolvedSettings();

  return {
    batchSize: settings.batchSize,
    batchDelaySeconds: settings.batchDelaySeconds,
    appBaseUrl: settings.appBaseUrl,
    openaiModel: settings.openaiModel,
    openaiHtmlPrompt: settings.openaiHtmlPrompt,
    hasOpenaiApiKey: Boolean(settings.openaiApiKey),
    maskedOpenaiApiKey: settings.openaiApiKey ? maskSecret(settings.openaiApiKey, { prefix: "sk-" }) : "",
  };
}

async function updateSettings(input) {
  for (const [key, value] of Object.entries(input)) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: value == null ? "" : String(value) },
      create: { key, value: value == null ? "" : String(value) },
    });
  }
}

module.exports = {
  getSettingsMap,
  getResolvedSettings,
  getAdminSettings,
  updateSettings,
  settingKeys,
  maskSecret,
  defaultOpenAiHtmlPrompt,
};
