const express = require("express");
const validator = require("validator");
const { requireAuth } = require("../middleware/auth");
const { pushFlash } = require("../utils/flash");
const { getResolvedSettings, updateSettings } = require("../services/settings-service");
const { listSenderProfiles, createSenderProfile } = require("../services/sender-profile-service");
const { listAdminUsers, createAdminUser, updateAdminPassword } = require("../services/admin-user-service");

const router = express.Router();

router.get("/settings", requireAuth, async (req, res) => {
  const [settings, senderProfiles, adminUsers] = await Promise.all([
    getResolvedSettings(),
    listSenderProfiles(),
    listAdminUsers(),
  ]);

  return res.render("settings/index", {
    title: "Settings",
    settings,
    senderProfiles,
    adminUsers,
  });
});

router.post("/settings", requireAuth, async (req, res) => {
  await updateSettings({
    batchSize: Number(req.body.batchSize || 100),
    batchDelaySeconds: Number(req.body.batchDelaySeconds || 60),
    appBaseUrl: String(req.body.appBaseUrl || "").trim(),
  });

  pushFlash(req, "success", "Settings saved.");
  return res.redirect("/settings");
});

router.post("/settings/senders", requireAuth, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const domain = String(req.body.domain || "").trim().toLowerCase();
  const fromName = String(req.body.fromName || "").trim();
  const fromEmail = String(req.body.fromEmail || "").trim().toLowerCase();
  const postmarkToken = String(req.body.postmarkToken || "").trim();
  const messageStream = String(req.body.messageStream || "broadcast").trim();
  const isDefault = req.body.isDefault === "on";
  const status = String(req.body.status || "active").trim();

  if (!name || !fromName || !domain || !postmarkToken || !validator.isEmail(fromEmail)) {
    pushFlash(req, "error", "Enter a sender name, domain, from name, valid from email, and Postmark token.");
    return res.redirect("/settings");
  }

  try {
    await createSenderProfile({
      name,
      domain,
      fromName,
      fromEmail,
      postmarkToken,
      messageStream,
      status,
      isDefault,
    });
    pushFlash(req, "success", "Sender profile added.");
  } catch (error) {
    pushFlash(req, "error", "Could not save sender profile. That sender/message stream may already exist.");
  }

  return res.redirect("/settings");
});

router.post("/settings/admin-users", requireAuth, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!validator.isEmail(email) || password.length < 8) {
    pushFlash(req, "error", "Enter a valid admin email and a password with at least 8 characters.");
    return res.redirect("/settings");
  }

  try {
    await createAdminUser(email, password);
    pushFlash(req, "success", "Admin user created.");
  } catch (error) {
    pushFlash(req, "error", "Could not create admin user. That email may already exist.");
  }

  return res.redirect("/settings");
});

router.post("/settings/admin-users/:id/password", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const password = String(req.body.password || "");

  if (!password || password.length < 8) {
    pushFlash(req, "error", "Enter a password with at least 8 characters.");
    return res.redirect("/settings");
  }

  await updateAdminPassword(id, password);
  pushFlash(req, "success", "Admin password updated.");
  return res.redirect("/settings");
});

module.exports = router;
