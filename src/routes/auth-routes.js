const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const { pushFlash } = require("../utils/flash");

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

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    pushFlash(req, "error", "Invalid login credentials.");
    return res.redirect("/login");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    pushFlash(req, "error", "Invalid login credentials.");
    return res.redirect("/login");
  }

  req.session.user = {
    id: user.id,
    email: user.email,
  };

  pushFlash(req, "success", "Signed in successfully.");
  return res.redirect("/dashboard");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
