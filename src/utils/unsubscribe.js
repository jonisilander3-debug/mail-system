const crypto = require("crypto");
const prisma = require("../lib/prisma");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function ensureUnsubscribeToken(email) {
  const normalizedEmail = normalizeEmail(email);
  let record = await prisma.unsubscribe.findUnique({
    where: { email: normalizedEmail },
  });

  if (!record) {
    record = await prisma.unsubscribe.create({
      data: {
        email: normalizedEmail,
        token: crypto.randomBytes(24).toString("hex"),
      },
    });
  }

  return record.token;
}

module.exports = { normalizeEmail, ensureUnsubscribeToken };
