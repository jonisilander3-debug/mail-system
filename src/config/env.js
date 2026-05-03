const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(process.cwd(), ".env") });

function getNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  isProduction: process.env.NODE_ENV === "production",
  host: process.env.HOST || "0.0.0.0",
  port: getNumber(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "change-me",
  appBaseUrl: process.env.APP_BASE_URL || process.env.APP_URL || "http://localhost:3000",
  postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN || "",
  postmarkMessageStream: process.env.POSTMARK_MESSAGE_STREAM || "broadcast",
  postmarkFromEmail: process.env.POSTMARK_FROM_EMAIL || "",
  postmarkFromName: process.env.POSTMARK_FROM_NAME || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  defaultBatchSize: getNumber(process.env.DEFAULT_BATCH_SIZE, 100),
  defaultBatchDelaySeconds: getNumber(process.env.DEFAULT_BATCH_DELAY_SECONDS, 60),
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPassword: process.env.ADMIN_PASSWORD || "change-this-password",
};
