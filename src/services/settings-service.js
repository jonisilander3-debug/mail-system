const prisma = require("../lib/prisma");
const env = require("../config/env");

const settingKeys = ["batchSize", "batchDelaySeconds", "appBaseUrl"];

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
  updateSettings,
  settingKeys,
};
