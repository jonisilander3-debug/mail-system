const express = require("express");
const rateLimit = require("express-rate-limit");
const { pushFlash } = require("../utils/flash");
const { serializeAdminUser, verifyAdminCredentials } = require("../services/auth-service");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  return res.render("auth/login", {
    title: "Admin Login",
  });
});

router.post("/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
}), async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = await verifyAdminCredentials(email, password);
  if (!user || !user.isActive) {
    pushFlash(req, "error", "Invalid login credentials.");
    return res.redirect("/login");
  }

  req.session.user = serializeAdminUser(user);

  pushFlash(req, "success", "Signed in successfully.");
  return res.redirect("/dashboard");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
