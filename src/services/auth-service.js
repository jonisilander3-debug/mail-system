const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const env = require("../config/env");

function serializeAdminUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? 0,
    email: user.email,
  };
}

function buildEnvAdminUser() {
  return {
    id: 0,
    email: String(env.adminEmail || "").trim().toLowerCase(),
    isActive: true,
  };
}

async function verifyAdminCredentials(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  const envEmail = String(env.adminEmail || "").trim().toLowerCase();
  const envPassword = String(env.adminPassword || "");

  if (normalizedEmail === envEmail && rawPassword && rawPassword === envPassword) {
    return buildEnvAdminUser();
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const isValid = await bcrypt.compare(rawPassword, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return user;
}

module.exports = {
  serializeAdminUser,
  verifyAdminCredentials,
};
