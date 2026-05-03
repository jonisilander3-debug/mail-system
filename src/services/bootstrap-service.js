const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const env = require("../config/env");
const { getResolvedSettings, updateSettings } = require("./settings-service");
const { ensureDefaultSenderProfile } = require("./sender-profile-service");

async function ensureAdminUser() {
  const existing = await prisma.adminUser.findUnique({
    where: { email: env.adminEmail.toLowerCase() },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(env.adminPassword, 10);
    await prisma.adminUser.create({
      data: {
        email: env.adminEmail.toLowerCase(),
        passwordHash,
        isActive: true,
      },
    });
  }
}

async function ensureDefaultSettings() {
  const settings = await getResolvedSettings();

  await updateSettings({
    batchSize: settings.batchSize,
    batchDelaySeconds: settings.batchDelaySeconds,
    appBaseUrl: settings.appBaseUrl,
  });
}

async function bootstrapApp() {
  await ensureAdminUser();
  await ensureDefaultSettings();
  await ensureDefaultSenderProfile();
}

module.exports = { bootstrapApp };
